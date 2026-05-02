const { fal } = require("@fal-ai/client");
const { resolveVideoModelOrDefault } = require("./falModels");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function buildVideoInput(model, { prompt, durationSeconds, referenceUrls }) {
  const refs = Array.isArray(referenceUrls) ? referenceUrls.filter(Boolean) : [];
  const duration = Math.max(1, Math.min(30, Number(durationSeconds) || 4));
  // fal video models tolerate unknown keys, so we send all common spellings
  // for "start" and "end" frames — different families pick different ones:
  //   image_url + end_image_url   → Luma, Seedance, Happy Horse
  //   image_url + tail_image_url  → Kling
  //   image_url + last_image_url  → Wan
  const input = { prompt, duration };
  if (refs[0]) input.image_url = refs[0];
  if (refs[1]) {
    input.end_image_url = refs[1];
    input.tail_image_url = refs[1];
    input.image_tail_url = refs[1];
    input.last_image_url = refs[1];
  }
  if (refs.length > 0) input.image_urls = refs;
  return input;
}

/**
 * Generate a video clip with a fal video model. Returns the mp4 URL.
 * @param {{ modelId?: string, prompt: string, durationSeconds?: number,
 *           referenceUrls: string[], width?: number, height?: number }} opts
 */
async function generateFalVideo(opts) {
  const key = getFalCredentials();
  if (!key) throw new Error("FAL_API_KEY is not configured");

  const model = resolveVideoModelOrDefault(opts.modelId);
  if (!model) throw new Error("Unknown video model");

  const prompt = String(opts.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required");

  fal.config({ credentials: key });
  const input = buildVideoInput(model, {
    prompt,
    durationSeconds: opts.durationSeconds,
    referenceUrls: opts.referenceUrls,
  });

  const result = await fal.subscribe(model.id, { input, logs: false });
  const url =
    result?.data?.video?.url ||
    result?.data?.video_url ||
    result?.data?.url ||
    result?.data?.videos?.[0]?.url;
  if (!url || typeof url !== "string") {
    throw new Error("fal did not return a video URL");
  }
  return { url: url.trim(), model };
}

module.exports = { generateFalVideo };
