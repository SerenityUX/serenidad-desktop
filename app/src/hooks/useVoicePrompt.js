import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../config';

const TRIGGER_KEY = '`';
const DOT_COUNT = 3;
const SILENT_LEVELS = new Array(DOT_COUNT).fill(0);
const MIC_SENSITIVITY = 7;

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
 * Returns { active, mode: 'listening'|'loading', levels }.
 */
export default function useVoicePrompt({
  onPrompt,
  getAuthToken,
  getCurrentPrompt,
  getContext,
  getModelId,
  getReferences,
}) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState('listening');
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
  const getCurrentPromptRef = useRef(getCurrentPrompt);
  const getContextRef = useRef(getContext);
  const getModelIdRef = useRef(getModelId);
  const getReferencesRef = useRef(getReferences);

  useEffect(() => {
    onPromptRef.current = onPrompt;
  }, [onPrompt]);
  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
  }, [getAuthToken]);
  useEffect(() => {
    getCurrentPromptRef.current = getCurrentPrompt;
  }, [getCurrentPrompt]);
  useEffect(() => {
    getContextRef.current = getContext;
  }, [getContext]);
  useEffect(() => {
    getModelIdRef.current = getModelId;
  }, [getModelId]);
  useEffect(() => {
    getReferencesRef.current = getReferences;
  }, [getReferences]);

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
    setMode('listening');
    setLevels(SILENT_LEVELS);
  }, []);

  const sendAudio = useCallback(
    async (blob) => {
      const token = getAuthTokenRef.current?.();
      if (!token) {
        dismiss();
        return;
      }
      setMode('loading');
      try {
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        const currentPrompt = getCurrentPromptRef.current?.() || '';
        if (currentPrompt) fd.append('current_prompt', currentPrompt);
        const context = getContextRef.current?.() || '';
        if (context) fd.append('context', context);
        const modelId = getModelIdRef.current?.() || '';
        if (modelId) fd.append('model_id', modelId);
        const refs = getReferencesRef.current?.();
        if (Array.isArray(refs) && refs.length) {
          fd.append('references', JSON.stringify(refs));
        }

        const res = await fetch(apiUrl('/voice/prompt'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }
        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accPrompt = '';
        let promptStarted = false;
        let audioPlayed = false;

        const handleEvent = (event, data) => {
          if (event === 'prompt_chunk' && typeof data?.delta === 'string') {
            accPrompt += data.delta;
            promptStarted = true;
            onPromptRef.current?.(accPrompt);
          } else if (event === 'prompt_done' && typeof data?.text === 'string') {
            accPrompt = data.text;
            onPromptRef.current?.(accPrompt);
          } else if (event === 'response_audio' && data?.url && !audioPlayed) {
            audioPlayed = true;
            try {
              if (responseAudioRef.current) responseAudioRef.current.pause();
              const audio = new Audio(data.url);
              audio.volume = 0.9;
              responseAudioRef.current = audio;
              audio.play().catch(() => {});
            } catch (e) {
              console.warn('response audio play failed', e);
            }
          } else if (event === 'error') {
            console.error('voice stream error:', data?.error);
          }
        };

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sepIdx;
          while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
            const raw = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            let event = 'message';
            let dataStr = '';
            for (const line of raw.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
            }
            if (!dataStr) continue;
            try {
              handleEvent(event, JSON.parse(dataStr));
            } catch {
              /* ignore malformed event */
            }
          }
        }
        if (!promptStarted && !accPrompt) {
          // No prompt arrived (probably an error); just bail silently.
        }
        dismiss();
      } catch (e) {
        console.error('voice prompt error:', e);
        dismiss();
      }
    },
    [dismiss],
  );

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    pendingStopRef.current = false;
    setActive(true);
    setMode('listening');
    setLevels(SILENT_LEVELS);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error('mic blocked', e);
      isRecordingRef.current = false;
      dismiss();
      return;
    }
    if (pendingStopRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      isRecordingRef.current = false;
      pendingStopRef.current = false;
      dismiss();
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
      const norm = Math.min(1, rms * MIC_SENSITIVITY);
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
      cleanupRecording();
      dismiss();
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
        dismiss();
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

  return { active, mode, levels };
}
