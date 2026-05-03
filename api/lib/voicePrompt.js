const { fal } = require("@fal-ai/client");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function getGroqKey() {
  return process.env.GROQ_API_KEY || "";
}

const SYSTEM_PROMPT = `You write image-generation prompts for an anime scene editor.

Inputs you receive from the user message:
- CURRENT PROMPT: what's already in the prompt textarea (may be empty)
- VOICE: what the user just said into the mic

Your job: produce JSON with two fields, "prompt" and "response".

"prompt" rules:
- If CURRENT PROMPT is non-empty, treat VOICE as edit instructions and return the modified prompt — preserve everything VOICE didn't change.
- If CURRENT PROMPT is empty, build a fresh prompt from VOICE.
- Strip filler ("um", "uh"), false starts, and meta phrases like "I want a scene where".
- ALWAYS include concrete anime-style direction in the prompt itself. Pick details that fit the subject — e.g. "cel-shaded anime style, crisp line art, vibrant saturated palette, cinematic key-frame composition, soft rim light, expressive eyes, Studio Ghibli / modern shōnen feel." If CURRENT PROMPT already specifies a style, keep that style and don't pile on conflicting descriptors.
- Output the prompt as plain natural-language description, no quotes or labels.

"response" rules:
- Short spoken acknowledgement, max ~10 words, casual and warm.
- NEVER use "boss", "sir", "ma'am", or any honorific/term of address. Just acknowledge the task.
- Examples: "got it, on it.", "sweet, locked in.", "say less, working on it.", "done, prompt's updated.", "easy, queued up."

Output ONLY valid JSON shaped exactly: {"prompt": "...", "response": "..."}`;

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
async function structureWithLLM(transcript, currentPrompt) {
  const key = getGroqKey();
  if (!key) throw new Error("GROQ_API_KEY is not configured");

  const userMessage = `CURRENT PROMPT: ${currentPrompt ? currentPrompt : "(empty)"}\nVOICE: ${transcript}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
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
async function processVoicePrompt({ buffer, contentType, currentPrompt }) {
  const falKey = getFalCredentials();
  if (falKey) fal.config({ credentials: falKey });

  const transcript = await transcribeAudio({ buffer, contentType });
  const trimmedCurrent = String(currentPrompt || "").trim().slice(0, 2000);
  const { prompt, response } = await structureWithLLM(
    transcript,
    trimmedCurrent,
  );
  const responseAudioUrl = falKey ? await synthesizeSpeech(response) : null;

  return { prompt, response, audioUrl: responseAudioUrl, transcript };
}

module.exports = { processVoicePrompt };
