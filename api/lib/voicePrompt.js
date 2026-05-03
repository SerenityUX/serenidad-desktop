const { fal } = require("@fal-ai/client");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function getGroqKey() {
  return process.env.GROQ_API_KEY || "";
}

const SYSTEM_PROMPT = `You convert a user's spoken voice command into a clean text prompt for an anime image generator, plus a brief friendly acknowledgement spoken back to them.

Rules:
- "prompt" is the cleaned-up version of what the user said, suitable as an image-generation prompt. Strip filler words ("um", "uh"), false starts, and meta phrases like "I want a scene where". Keep their creative intent.
- "response" is a SHORT spoken acknowledgement (max ~10 words), casual and warm. Examples: "got it boss!", "on it!", "sweet, locked in.", "say less, working on it".
- Both fields must always be non-empty strings.
- Output ONLY valid JSON shaped exactly: {"prompt": "...", "response": "..."}`;

/** Groq Whisper turbo: typically <1s for short clips, no queue/upload step. */
async function transcribeAudio({ buffer, contentType }) {
  const key = getGroqKey();
  if (!key) throw new Error("GROQ_API_KEY is not configured");

  const ext = contentType && contentType.includes("mp4") ? "mp4" : "webm";
  const blob = new Blob([buffer], { type: contentType || "audio/webm" });
  const fd = new FormData();
  fd.append("file", blob, `voice.${ext}`);
  fd.append("model", "whisper-large-v3-turbo");
  fd.append("response_format", "json");
  fd.append("temperature", "0");

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq STT ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Transcription returned no text");
  }
  return text.trim();
}

/** Groq llama 8b instant: ~200-500ms for short JSON outputs. */
async function structureWithLLM(transcript) {
  const key = getGroqKey();
  if (!key) throw new Error("GROQ_API_KEY is not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq LLM ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("LLM returned no content");

  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("LLM response was not valid JSON");
  }
  const prompt = String(parsed.prompt || "").trim();
  const response = String(parsed.response || "").trim();
  if (!prompt) throw new Error("LLM returned empty prompt");
  return { prompt, response: response || "Got it." };
}

async function synthesizeSpeech(text) {
  try {
    const result = await fal.subscribe("fal-ai/kokoro/american-english", {
      input: { prompt: text, voice: "af_heart" },
      logs: false,
    });
    const url = result?.data?.audio?.url || result?.data?.audio_url;
    return typeof url === "string" ? url : null;
  } catch (e) {
    console.warn("TTS failed, returning null audio:", e.message);
    return null;
  }
}

/**
 * Pipeline: audio buffer → transcript (Groq Whisper) → {prompt, response} (Groq Llama) → response audio (fal kokoro).
 * @param {{ buffer: Buffer, contentType: string }} audio
 * @returns {Promise<{ prompt: string, response: string, audioUrl: string|null, transcript: string }>}
 */
async function processVoicePrompt({ buffer, contentType }) {
  const falKey = getFalCredentials();
  if (falKey) fal.config({ credentials: falKey });

  const transcript = await transcribeAudio({ buffer, contentType });
  const { prompt, response } = await structureWithLLM(transcript);
  const responseAudioUrl = falKey ? await synthesizeSpeech(response) : null;

  return { prompt, response, audioUrl: responseAudioUrl, transcript };
}

module.exports = { processVoicePrompt };
