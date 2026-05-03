const { fal } = require("@fal-ai/client");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function getOpenRouterKey() {
  return process.env.OPENROUTER_API_KEY || "";
}

const SYSTEM_PROMPT = `You convert a user's spoken voice command into a clean text prompt for an anime image generator, plus a brief friendly acknowledgement spoken back to them.

Rules:
- "prompt" is the cleaned-up version of what the user said, suitable as an image-generation prompt. Strip filler words ("um", "uh"), false starts, and meta phrases like "I want a scene where". Keep their creative intent.
- "response" is a SHORT spoken acknowledgement (max ~10 words), casual and warm. Examples: "got it boss!", "on it!", "sweet, locked in.", "say less, working on it".
- Both fields must always be non-empty strings.`;

async function transcribeAudio(audioUrl) {
  const result = await fal.subscribe("fal-ai/whisper", {
    input: { audio_url: audioUrl, task: "transcribe" },
    logs: false,
  });
  const text = result?.data?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Transcription returned no text");
  }
  return text.trim();
}

async function structureWithLLM(transcript) {
  const key = getOpenRouterKey();
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "voice_prompt",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              prompt: { type: "string" },
              response: { type: "string" },
            },
            required: ["prompt", "response"],
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
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
 * Pipeline: audio buffer → transcript → { prompt, response } → response audio.
 * @param {{ buffer: Buffer, contentType: string }} audio
 * @returns {Promise<{ prompt: string, response: string, audioUrl: string|null, transcript: string }>}
 */
async function processVoicePrompt({ buffer, contentType }) {
  const key = getFalCredentials();
  if (!key) throw new Error("FAL_API_KEY is not configured");
  fal.config({ credentials: key });

  const blob = new Blob([buffer], { type: contentType || "audio/webm" });
  const file = new File([blob], "voice.webm", {
    type: contentType || "audio/webm",
  });
  const audioUrl = await fal.storage.upload(file);

  const transcript = await transcribeAudio(audioUrl);
  const { prompt, response } = await structureWithLLM(transcript);
  const responseAudioUrl = await synthesizeSpeech(response);

  return { prompt, response, audioUrl: responseAudioUrl, transcript };
}

module.exports = { processVoicePrompt };
