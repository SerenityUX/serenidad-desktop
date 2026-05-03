const { fal } = require("@fal-ai/client");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function getGroqKey() {
  return process.env.GROQ_API_KEY || "";
}

function getOpenRouterKey() {
  return process.env.OPEN_ROUTER_API_TOKEN || process.env.OPENROUTER_API_KEY || "";
}

const OR_HEADERS = {
  "HTTP-Referer": "https://kodan.local",
  "X-Title": "Kodan Voice Prompt",
};

/** Fastest reasonable streaming model on OpenRouter for short prose. */
const PROMPT_MODEL = "google/gemini-2.5-flash-lite";
const ACK_MODEL = "google/gemini-2.5-flash-lite";

const PROMPT_BUILDER_SYSTEM = `You write image-generation prompts for an anime scene editor.

The user message contains:
- MODEL: the image model being used. If the model id contains "/edit" or "kontext", the user is in EDIT MODE — references are source images being modified, not separate input. Otherwise it's text-to-image.
- REFERENCES: URLs of any reference images attached to the current scene (may be empty).
- CONTEXT: the project's other scene prompts so you understand the world/style.
- CURRENT PROMPT: what's already in the prompt textarea for the scene being edited (may be empty).
- VOICE: what the user just said into the mic.

Output ONLY the new prompt text — no JSON, no labels, no quotes, no preamble.

Behaviour by mode:

EDIT MODE (model has /edit or kontext, AND references exist):
- Output should be CONCISE EDIT INSTRUCTIONS describing what to change about the reference images.
- Examples: "make her hair longer and silver", "add a sunset sky and city skyline", "change his expression to wide-eyed shock", "remove the umbrella, add falling cherry blossoms".
- Do NOT re-describe the whole scene. Don't pile on style descriptors. Speak as instructions to the editor.

TEXT-TO-IMAGE MODE (everything else, or edit model with no references):
- Output a full scene prompt as plain natural-language description.
- ALWAYS bake concrete anime-style direction into the prompt (cel-shaded line art, vibrant saturated palette, cinematic key-frame composition, soft rim light, expressive eyes, Ghibli / modern shōnen / 90s OVA feel — pick what fits). Don't pile on conflicting styles if CURRENT PROMPT or CONTEXT already established one.
- Single paragraph.

Both modes:
- If CURRENT PROMPT is non-empty, treat VOICE as edit instructions on that prompt — preserve everything VOICE didn't change.
- If CURRENT PROMPT is empty, build a fresh prompt from VOICE.
- Use CONTEXT to keep recurring characters / locations / style consistent with the rest of the project.
- Strip filler words ("um", "uh"), false starts, and meta phrases like "I want a scene where".`;

const ACK_SYSTEM = `Respond with ONE short, casual, varied acknowledgement of what the user just asked you to do (max 8 words). No honorifics ("boss", "sir", "ma'am", "chief", "buddy" — never). Vary the wording every time — sometimes confirming, sometimes encouraging, sometimes mildly playful. Output only the acknowledgement text — no quotes, no JSON, no labels.`;

/** Groq Whisper turbo — sub-second for short clips. (OpenRouter doesn't host STT.) */
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
    { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd },
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

/** Quick non-streamed acknowledgement via OpenRouter. */
async function generateAck(transcript) {
  const key = getOpenRouterKey();
  if (!key) throw new Error("OPEN_ROUTER_API_TOKEN is not configured");

  const res = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...OR_HEADERS,
      },
      body: JSON.stringify({
        model: ACK_MODEL,
        temperature: 1.0,
        max_tokens: 30,
        messages: [
          { role: "system", content: ACK_SYSTEM },
          { role: "user", content: transcript },
        ],
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ack ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  return text || "alright.";
}

/**
 * Stream the rebuilt prompt. Calls `onChunk(delta)` for each piece.
 * Resolves with the full assembled string.
 */
async function streamPrompt({
  transcript,
  currentPrompt,
  context,
  modelId,
  references,
  onChunk,
}) {
  const key = getOpenRouterKey();
  if (!key) throw new Error("OPEN_ROUTER_API_TOKEN is not configured");

  const refs = Array.isArray(references) ? references.filter(Boolean) : [];
  const refLines = refs.length
    ? refs.map((u, i) => `  ${i + 1}. ${u}`).join("\n")
    : "  (none attached)";

  const userMessage = [
    `MODEL: ${modelId || "(unknown)"}`,
    `REFERENCES (${refs.length}):\n${refLines}`,
    `CONTEXT:\n${context ? context : "(no other scenes yet)"}`,
    `CURRENT PROMPT: ${currentPrompt ? currentPrompt : "(empty)"}`,
    `VOICE: ${transcript}`,
  ].join("\n\n");

  const res = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...OR_HEADERS,
      },
      body: JSON.stringify({
        model: PROMPT_MODEL,
        temperature: 0.7,
        max_tokens: 600,
        stream: true,
        messages: [
          { role: "system", content: PROMPT_BUILDER_SYSTEM },
          { role: "user", content: userMessage },
        ],
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter prompt ${res.status}: ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nlIdx;
    while ((nlIdx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length) {
            full += delta;
            onChunk(delta);
          }
        } catch {
          /* ignore malformed line */
        }
      }
    }
  }
  return full.trim();
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

module.exports = {
  transcribeAudio,
  generateAck,
  streamPrompt,
  synthesizeSpeech,
  getFalCredentials,
};
