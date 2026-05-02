/**
 * Render a scene (image + caption) into a PNG data URL.
 *
 * Pure, state-driven: the same `(imageUrl, captionSettings, dimensions)` input
 * always produces the same PNG. The export pipeline composes one PNG per scene
 * and ffmpeg muxes them into an mp4. This is the same model Remotion uses
 * (state → frame → encoder), kept lightweight by reusing the canvas API and
 * the fluent-ffmpeg wrapper that ships with the app.
 */
async function loadImageBitmap(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const blob = await res.blob();
  return await createImageBitmap(blob);
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split(/\r?\n/);
  const lines = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function composeSceneToPng(scene, { width, height }) {
  const w = Math.max(2, Math.floor(width || 1280));
  const h = Math.max(2, Math.floor(height || 720));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  if (scene.thumbnail) {
    try {
      const bmp = await loadImageBitmap(scene.thumbnail);
      // Cover-fit to canvas to match preview's objectFit: 'cover'.
      const sr = bmp.width / bmp.height;
      const dr = w / h;
      let dw = w;
      let dh = h;
      let dx = 0;
      let dy = 0;
      let sx = 0;
      let sy = 0;
      let sw = bmp.width;
      let sh = bmp.height;
      if (sr > dr) {
        sw = bmp.height * dr;
        sx = (bmp.width - sw) / 2;
      } else {
        sh = bmp.width / dr;
        sy = (bmp.height - sh) / 2;
      }
      ctx.drawImage(bmp, sx, sy, sw, sh, dx, dy, dw, dh);
    } catch (err) {
      console.error('composeSceneToPng: image load failed', err);
    }
  }

  const cs = scene.captionSettings || {};
  const text = (cs.caption || '').trim();
  if (text) {
    // Caption font size in the editor is given in CSS px relative to the
    // preview. Scale into export resolution by the same ratio used for the
    // image so the caption looks the same on screen and in the mp4.
    const fontSize = Math.round((cs.fontSize || 16) * (h / 360));
    const weight = cs.selectedWeight || '700';
    const family = cs.selectedFont || 'Arial';
    ctx.font = `${weight} ${fontSize}px "${family}", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const maxWidth = w * 0.9;
    const lines = wrapLines(ctx, text, maxWidth);
    const lineHeight = Math.round(fontSize * 1.2);
    const totalHeight = lines.length * lineHeight;
    const baseY = h - Math.round(h * 0.06) - totalHeight + lineHeight;
    const strokeSize = Number(cs.strokeSize || 0);
    if (strokeSize > 0) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = cs.strokeColor || '#000';
      ctx.lineWidth = strokeSize * (h / 360) * 2;
      lines.forEach((line, i) => {
        if (line) ctx.strokeText(line, w / 2, baseY + i * lineHeight);
      });
    }
    ctx.fillStyle = cs.captionColor || '#FFE600';
    lines.forEach((line, i) => {
      if (line) ctx.fillText(line, w / 2, baseY + i * lineHeight);
    });
  }

  return canvas.toDataURL('image/png');
}
