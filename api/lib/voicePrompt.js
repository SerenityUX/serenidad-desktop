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

// Multimodal + fast. Smarter than flash-lite at intent routing and short-edit
// pass-through, while still cheap/quick enough for hold-to-talk UX.
const VOICE_MODEL = "google/gemini-2.5-flash";

const IMAGE_REF_RE = /\.(png|jpe?g|webp|gif|bmp|tiff)(\?|$)/i;

const VOICE_UPDATE_SYSTEM = `You are an inline assistant inside an ANIME STORYBOARD editor — every output frame is anime by default. You receive a single short voice command and return a JSON patch describing how to update the current scene. Be minimal — never invent details the user didn't ask for.

INPUTS (in the user message):
- MODEL: image/video model id. Treat as EDIT MODE if the id contains "/edit", "kontext", "image-to-", "video-to-", or "reference-to-".
- REFERENCES: URLs of images attached to this scene. The actual images are also attached as image inputs in this message — look at them to ground your output in what's already on screen.
- CONTEXT: other scene prompts in this project (for style continuity).
- CURRENT PROMPT: existing prompt textarea content.
- CURRENT VOICELINE: existing voiceline.
- CURRENT SPEAKER: currently selected voice option.
- AVAILABLE SPEAKERS: the only valid values for the speaker field.
- VOICE: what the user just said into the mic.

OUTPUT — return ONLY this JSON object, no markdown fences, no preamble:
{
  "prompt": string,
  "voiceline": string | null,
  "speaker": string | null,
  "editorResponse": string
}

==== prompt ====
This is what goes in the prompt textarea. Always return a string (use CURRENT PROMPT verbatim if VOICE doesn't change the visual).

Routing — pick ONE rule:
1. EDIT MODE *or* references attached, AND VOICE is a short edit ("make it night", "blue hair", "remove the cat", "add a speech bubble saying X"):
   - If CURRENT PROMPT is empty → prompt = the cleaned VOICE phrase, kept short and verbatim. Example: VOICE "make it night" → prompt "make it night". Do NOT expand into a full scene description.
   - If CURRENT PROMPT is non-empty → fold the edit into CURRENT PROMPT, preserving everything VOICE didn't touch. Stay roughly the same length.
2. NO references attached AND VOICE describes a scene (any subject, even short like "two people eating lunch"):
   - This is a from-scratch base image generation for an anime storyboard. Lean into anime stylistic direction.
   - Build a single-paragraph natural-language prompt that bakes in concrete anime-style cues fitting the subject: line-art quality, palette/lighting, composition / shot framing, era-or-studio feel (e.g. 90s cel-shaded, modern Kyoto Animation softness, Ghibli warmth, shōnen ink line, etc.). Pick what fits the subject — don't pile on conflicting descriptors.
   - If CONTEXT already establishes a style, stay consistent with it instead of inventing a new one.
   - Be specific (camera angle, lighting, mood) so the image model has something to work with — but don't over-write a long essay; one tight paragraph.
3. References ARE attached AND VOICE describes a fresh scene ("come up with...", "make a scene where..."):
   - Build the scene prompt suited to MODEL but DO NOT add anime / art-style descriptors — the references already convey the visual style. Describe subject, action, composition, lighting only.
4. VOICE only sets voiceline / speaker / caption text and does not change the visual at all:
   - prompt = CURRENT PROMPT unchanged.

If VOICE mentions "caption" / "speech bubble" / on-screen text, describe that text element in the prompt so the image model renders it (not the editor caption overlay).

Always strip filler ("um", "uh", false starts, "I want a scene where", "let's").

==== voiceline ====
Spoken dialogue for this scene. Only set when VOICE explicitly dictates dialogue ("have her say X", "she shouts Y", quoted speech, "make her line: X"). Otherwise null. NEVER invent dialogue.

==== speaker ====
Voice option for the line. Only set when VOICE explicitly asks to change the voice ("use a male voice", "switch to Female - Soft", "make the speaker female"). Match the user's intent to the closest entry in AVAILABLE SPEAKERS, returning the EXACT string from that list. Otherwise null.

==== editorResponse ====
ONE short, casual, varied acknowledgement of what you just did (max 8 words). No honorifics ("boss", "sir", "ma'am", "chief", "buddy"). Vary wording every time.`;

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

function pickClosestSpeaker(value, allowed) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  const exact = allowed.find((s) => s.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  // tolerant: match by substring (e.g. model said "Male Deep" → "Male - Deep")
  const norm = (s) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim();
  const target = norm(v);
  const fuzzy = allowed.find((s) => norm(s) === target);
  return fuzzy || null;
}

async function generateVoiceUpdate({
  transcript,
  currentPrompt,
  currentVoiceline,
  currentSpeaker,
  availableSpeakers,
  context,
  modelId,
  references,
}) {
  const key = getOpenRouterKey();
  if (!key) throw new Error("OPEN_ROUTER_API_TOKEN is not configured");

  const refs = Array.isArray(references) ? references.filter(Boolean) : [];
  const imageRefs = refs.filter((u) => IMAGE_REF_RE.test(u));
  const speakers = Array.isArray(availableSpeakers) && availableSpeakers.length
    ? availableSpeakers
    : ["Narrator"];

  const refLines = refs.length
    ? refs.map((u, i) => `  ${i + 1}. ${u}`).join("\n")
    : "  (none attached)";

  const userText = [
    `MODEL: ${modelId || "(unknown)"}`,
    `REFERENCES (${refs.length}):\n${refLines}`,
    `CONTEXT:\n${context ? context : "(no other scenes yet)"}`,
    `CURRENT PROMPT: ${currentPrompt ? currentPrompt : "(empty)"}`,
    `CURRENT VOICELINE: ${currentVoiceline ? currentVoiceline : "(empty)"}`,
    `CURRENT SPEAKER: ${currentSpeaker || "(none)"}`,
    `AVAILABLE SPEAKERS: ${speakers.join(", ")}`,
    `VOICE: ${transcript}`,
  ].join("\n\n");

  const userContent = [{ type: "text", text: userText }];
  // Cap at 4 images to keep latency tight.
  for (const url of imageRefs.slice(0, 4)) {
    userContent.push({ type: "image_url", image_url: { url } });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...OR_HEADERS,
    },
    body: JSON.stringify({
      model: VOICE_MODEL,
      temperature: 0.4,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VOICE_UPDATE_SYSTEM },
        { role: "user", content: userContent },
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
  const speaker = pickClosestSpeaker(parsed.speaker, speakers);
  const editorResponse =
    String(parsed.editorResponse || "").trim() || "got it.";
  return { voiceline, prompt, speaker, editorResponse };
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
