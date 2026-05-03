import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../config';

const TRIGGER_KEY = '`';
const BAR_COUNT = 5;
const SILENT_LEVELS = new Array(BAR_COUNT).fill(0);

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
};

/** Short upward "bubble" pop synthesised on the fly so we don't ship an asset. */
const playBubble = (audioCtx) => {
  try {
    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {
    console.warn('bubble sound failed', e);
  }
};

/**
 * Hold-to-talk hook: hold backtick to record, release to send.
 * Calls `onPrompt(text)` with the transcribed/cleaned prompt; returns indicator state.
 */
export default function useVoicePrompt({ onPrompt, getAuthToken }) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('');
  const [levels, setLevels] = useState(SILENT_LEVELS);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const isRecordingRef = useRef(false);
  const pendingStopRef = useRef(false);
  const responseAudioRef = useRef(null);
  const onPromptRef = useRef(onPrompt);
  const getAuthTokenRef = useRef(getAuthToken);

  useEffect(() => {
    onPromptRef.current = onPrompt;
  }, [onPrompt]);
  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
  }, [getAuthToken]);

  const cleanupRecording = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    recorderRef.current = null;
    isRecordingRef.current = false;
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    setStatus('');
    setLevels(SILENT_LEVELS);
  }, []);

  const sendAudio = useCallback(
    async (blob) => {
      const token = getAuthTokenRef.current?.();
      if (!token) {
        setStatus('Not signed in');
        setTimeout(dismiss, 1200);
        return;
      }
      setStatus('Transcribing…');
      try {
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        const res = await fetch(apiUrl('/voice/prompt'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        if (data.prompt) {
          onPromptRef.current?.(data.prompt);
        }
        if (data.audio_url) {
          try {
            if (responseAudioRef.current) {
              responseAudioRef.current.pause();
            }
            const audio = new Audio(data.audio_url);
            audio.volume = 0.9;
            responseAudioRef.current = audio;
            audio.play().catch(() => {});
          } catch (e) {
            console.warn('response audio play failed', e);
          }
        }
        setStatus(data.response || 'Got it.');
        setTimeout(dismiss, 1400);
      } catch (e) {
        console.error(e);
        setStatus(`Error: ${e.message}`);
        setTimeout(dismiss, 1800);
      }
    },
    [dismiss],
  );

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    pendingStopRef.current = false;
    setActive(true);
    setStatus('Listening…');
    setLevels(SILENT_LEVELS);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error(e);
      setStatus('Mic blocked');
      setTimeout(dismiss, 1500);
      isRecordingRef.current = false;
      return;
    }
    if (pendingStopRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      isRecordingRef.current = false;
      pendingStopRef.current = false;
      setStatus('Too short');
      setTimeout(dismiss, 900);
      return;
    }
    streamRef.current = stream;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    playBubble(audioCtx);

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      const norm = Math.min(1, rms * 3.2);
      setLevels((prev) => {
        const next = prev.slice(1);
        next.push(norm);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const mimeCandidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      '',
    ];
    let recorder;
    for (const m of mimeCandidates) {
      try {
        recorder = m
          ? new MediaRecorder(stream, { mimeType: m })
          : new MediaRecorder(stream);
        break;
      } catch {
        recorder = null;
      }
    }
    if (!recorder) {
      setStatus('Recorder unsupported');
      setTimeout(dismiss, 1500);
      cleanupRecording();
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const elapsed = Date.now() - startedAtRef.current;
      cleanupRecording();
      if (blob.size < 800 || elapsed < 250) {
        setStatus('Too short');
        setTimeout(dismiss, 900);
        return;
      }
      sendAudio(blob);
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start();
    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      try {
        recorder.stop();
      } catch {
        cleanupRecording();
        dismiss();
      }
    }
  }, [cleanupRecording, dismiss, sendAudio]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder) {
      pendingStopRef.current = true;
      return;
    }
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (e) {
        console.warn(e);
        cleanupRecording();
        dismiss();
      }
    } else {
      cleanupRecording();
      dismiss();
    }
  }, [cleanupRecording, dismiss]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== TRIGGER_KEY) return;
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      startRecording();
    };
    const onKeyUp = (e) => {
      if (e.key !== TRIGGER_KEY) return;
      if (!isRecordingRef.current) return;
      e.preventDefault();
      stopRecording();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startRecording, stopRecording]);

  useEffect(() => () => cleanupRecording(), [cleanupRecording]);

  return { active, status, levels };
}
