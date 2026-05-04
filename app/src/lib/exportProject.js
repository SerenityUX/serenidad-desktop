/**
 * Project export. Uses WebCodecs (`VideoEncoder`) to encode at full project
 * resolution offline (not realtime), and `mp4-muxer` to wrap the H.264 chunks
 * into an mp4 in memory. The result is a transferable ArrayBuffer.
 *
 * Image segments hold for `durationSeconds` (so a 2s image at 30fps emits 60
 * frames pointing at the same canvas). Video segments are seeked frame-by-
 * frame at the project framerate so the output is the exact composition the
 * user sees in the editor.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const FPS = 30;
const MICROS_PER_FRAME = Math.round(1_000_000 / FPS);

function bitrateFor(width, height) {
  // ~0.18 bits/pixel * fps lands at ~5.5 Mbps for 720p30, ~12 Mbps for 1080p30.
  return Math.round(width * height * 0.18 * FPS);
}

function drawCover(ctx, source, sw, sh, w, h) {
  if (!sw || !sh) return;
  const sr = sw / sh;
  const dr = w / h;
  let cx = 0;
  let cy = 0;
  let cw = sw;
  let ch = sh;
  if (sr > dr) {
    cw = sh * dr;
    cx = (sw - cw) / 2;
  } else {
    ch = sw / dr;
    cy = (sh - ch) / 2;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, cx, cy, cw, ch, 0, 0, w, h);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

/**
 * Pull remote bytes through the Electron main process to dodge CORS — the
 * fal/storage URLs we hand back from the API don't always include
 * Access-Control-Allow-Origin, and a renderer-side `fetch` then fails with
 * a generic "Failed to fetch". The main process has no CORS, so it just
 * works. Falls back to a direct fetch in non-Electron contexts (web build).
 */
async function fetchAsBlobUrl(url) {
  const ipc = typeof window !== 'undefined' && window.electron?.ipcRenderer;
  if (ipc) {
    const { buffer, contentType } = await ipc.invoke('fetch-remote-bytes', url);
    const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const blob = new Blob([view], { type: contentType || 'application/octet-stream' });
    return URL.createObjectURL(blob);
  }
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function loadVideo(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = src;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('Video load failed: ' + src));
  });
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('Seek failed'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    // Clamp to a hair under the end so we always land on a decoded frame.
    video.currentTime = Math.max(0, Math.min(time, video.duration - 0.001));
  });
}

async function encodeFrameFromCanvas(canvas, encoder, timestampUs, isKeyFrame) {
  const frame = new VideoFrame(canvas, {
    timestamp: timestampUs,
    duration: MICROS_PER_FRAME,
  });
  encoder.encode(frame, { keyFrame: isKeyFrame });
  frame.close();
  // Backpressure: don't queue more than the encoder can chew on at once.
  if (encoder.encodeQueueSize > 16) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

export async function encodeSegmentsToMp4(segments, { width, height, onProgress }) {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs is not available in this runtime.');
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('No segments to export.');
  }

  // H.264 requires even dimensions.
  const w = Math.max(2, Math.floor(width || 1280));
  const h = Math.max(2, Math.floor(height || 720));
  const evenW = w - (w % 2);
  const evenH = h - (h % 2);

  const canvas = new OffscreenCanvas(evenW, evenH);
  const ctx = canvas.getContext('2d');

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: evenW,
      height: evenH,
      frameRate: FPS,
    },
    fastStart: 'in-memory',
  });

  let encodeError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  encoder.configure({
    codec: 'avc1.640028',
    width: evenW,
    height: evenH,
    bitrate: bitrateFor(evenW, evenH),
    framerate: FPS,
    latencyMode: 'quality',
  });

  // Pre-compute total frames for progress reporting.
  let totalFrames = 0;
  const segmentFrameCounts = segments.map((s) => {
    const dur = Math.max(0.1, Number(s.durationSeconds) || (s.kind === 'video' ? 4 : 2));
    const count = Math.max(1, Math.round(dur * FPS));
    totalFrames += count;
    return count;
  });
  let processed = 0;

  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const frameCount = segmentFrameCounts[i];
      if (encodeError) throw encodeError;

      if (seg.kind === 'image') {
        const img = await loadImage(seg.dataUrl);
        drawCover(ctx, img, img.naturalWidth, img.naturalHeight, evenW, evenH);
        for (let f = 0; f < frameCount; f++) {
          // Force a keyframe at the start of every segment so playback can
          // seek cleanly to scene boundaries.
          await encodeFrameFromCanvas(
            canvas,
            encoder,
            (processed + f) * MICROS_PER_FRAME,
            f === 0,
          );
          if (onProgress) onProgress((processed + f + 1) / totalFrames);
        }
        processed += frameCount;
      } else {
        const blobUrl = await fetchAsBlobUrl(seg.src);
        try {
          const video = await loadVideo(blobUrl);
          // Ensure first frame is decoded.
          await seekVideo(video, 0);
          for (let f = 0; f < frameCount; f++) {
            await seekVideo(video, f / FPS);
            drawCover(ctx, video, video.videoWidth, video.videoHeight, evenW, evenH);
            await encodeFrameFromCanvas(
              canvas,
              encoder,
              (processed + f) * MICROS_PER_FRAME,
              f === 0,
            );
            if (onProgress) onProgress((processed + f + 1) / totalFrames);
          }
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
        processed += frameCount;
      }
    }

    await encoder.flush();
    if (encodeError) throw encodeError;
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }

  muxer.finalize();
  return muxer.target.buffer;
}
