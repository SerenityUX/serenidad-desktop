const { fal } = require("@fal-ai/client");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function getGroqKey() {
  return process.env.GROQ_API_KEY || "";
}

function getOpenRouterKey() {
  const raw =
    process.env.OPEN_ROUTER_API_TOKEN ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_TOKEN ||
    "";
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const OR_HEADERS = {
  "HTTP-Referer": "https://kodan.local",
  "X-Title": "Kodan Voice Prompt",
};

const VOICE_MODEL = "google/gemini-2.5-flash-lite";

const VOICE_UPDATE_SYSTEM = `You are an assistant inside an anime scene editor. You receive what the user just said into the mic and return a JSON object describing how to update the current scene.

The user message contains:
- MODEL: image/video model id. If the id contains "/edit" or "kontext", treat the request as EDIT MODE when references are also present.
- REFERENCES: URLs of reference images attached to the current scene.
- CONTEXT: the project's other scene prompts so you understand the world/style.
- CURRENT PROMPT: what's already in the prompt textarea.
- CURRENT VOICELINE: what's already in the voiceline textbox.
- VOICE: what the user just said into the mic. THIS is the source of truth.

Return ONLY a JSON object with these fields, no preamble, no markdown fences:
{
  "voiceline": string | null,
  "prompt": string,
  "editorResponse": string
}

voiceline:
- If the VOICE explicitly dictates spoken dialogue for the scene (e.g. "have him say...", "she shouts...", quoted dialogue), return that line as a clean string.
- Otherwise return null. Do not invent dialogue.
- If the user is editing existing dialogue, return the new full dialogue.

prompt:
- A scene prompt for the image/video model, derived from VOICE.
- EDIT MODE (edit model id AND references present): a CONCISE edit instruction describing the change VOICE asks for. Don't re-describe the whole scene.
- TEXT-TO-IMAGE/VIDEO MODE: a full single-paragraph natural-language scene description with anime-style direction that fits the subject. Don't pile on conflicting style descriptors if CURRENT PROMPT or CONTEXT already established a style.
- If CURRENT PROMPT is non-empty, treat VOICE as edit instructions ON it — preserve everything VOICE didn't change.
- If CURRENT PROMPT is empty, build fresh from VOICE.
- Use CONTEXT to keep recurring characters / locations / style consistent.
- Strip filler ("um", "uh"), false starts, and meta phrases like "I want a scene where".

editorResponse:
- ONE short, casual, varied acknowledgement of what the user asked (max 8 words).
- No honorifics ("boss", "sir", "ma'am", "chief", "buddy").
- Vary the wording every time.`;

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

function stripJsonFence(s) {
  let t = String(s || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?/i, "").trim();
    if (t.endsWith("```")) t = t.slice(0, -3).trim();
  }
  return t;
}

async function generateVoiceUpdate({
  transcript,
  currentPrompt,
  currentVoiceline,
  context,
  modelId,
  references,
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
    `CURRENT VOICELINE: ${currentVoiceline ? currentVoiceline : "(empty)"}`,
    `VOICE: ${transcript}`,
  ].join("\n\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...OR_HEADERS,
    },
    body: JSON.stringify({
      model: VOICE_MODEL,
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VOICE_UPDATE_SYSTEM },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter voice ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = String(data?.choices?.[0]?.message?.content || "").trim();
  let parsed;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch (e) {
    throw new Error(`Voice model returned non-JSON: ${raw.slice(0, 200)}`);
  }
  const voiceline =
    typeof parsed.voiceline === "string" && parsed.voiceline.trim()
      ? parsed.voiceline.trim()
      : null;
  const prompt = String(parsed.prompt || "").trim();
  const editorResponse =
    String(parsed.editorResponse || "").trim() || "alright.";
  return { voiceline, prompt, editorResponse };
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
  generateVoiceUpdate,
  synthesizeSpeech,
  getFalCredentials,
};
