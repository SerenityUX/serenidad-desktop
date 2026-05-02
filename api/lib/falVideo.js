const { fal } = require("@fal-ai/client");
const { resolveVideoModelOrDefault } = require("./falModels");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function buildVideoInput(model, { prompt, durationSeconds, referenceUrls, width, height }) {
  const refs = Array.isArray(referenceUrls) ? referenceUrls.filter(Boolean) : [];
  const duration = Math.max(1, Math.min(30, Number(durationSeconds) || 4));
  // Pass both single- and dual-image keys; fal models tolerate extras and pick
  // what they need. "image_url" + "end_image_url" is the common shape for
  // image-to-video models that support a target end-frame.
  const input = {
    prompt,
    duration,
  };
  if (refs[0]) input.image_url = refs[0];
  if (refs[1]) input.end_image_url = refs[1];
  if (refs.length > 0) input.image_urls = refs;
  if (Number(width) > 0 && Number(height) > 0) {
    input.resolution = `${width}x${height}`;
    input.image_size = { width: Number(width), height: Number(height) };
  }
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
    width: opts.width,
    height: opts.height,
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
