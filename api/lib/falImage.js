const { fal } = require("@fal-ai/client");
const { aspectRatioForDimensions } = require("./falNanoBanana");
const { resolveModelOrDefault } = require("./falModels");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

function buildInputForModel(model, { prompt, width, height, referenceUrls }) {
  const aspect_ratio = aspectRatioForDimensions(width, height);
  const refs = Array.isArray(referenceUrls) ? referenceUrls.filter(Boolean) : [];

  switch (model.family) {
    case "nano-banana": {
      const input = {
        prompt,
        num_images: 1,
        aspect_ratio,
        output_format: "png",
        resolution: "1K",
        limit_generations: true,
      };
      if (model.supportsReferences && refs.length) {
        input.image_urls = refs;
      }
      return input;
    }
    case "flux-kontext": {
      const input = {
        prompt,
        num_images: 1,
        aspect_ratio,
        output_format: "png",
      };
      if (refs.length) input.image_url = refs[0];
      return input;
    }
    case "flux": {
      return {
        prompt,
        num_images: 1,
        image_size: { width: Number(width) || 1280, height: Number(height) || 720 },
      };
    }
    case "ideogram":
    case "recraft":
    case "imagen":
    default: {
      return {
        prompt,
        num_images: 1,
        aspect_ratio,
        image_size: { width: Number(width) || 1280, height: Number(height) || 720 },
      };
    }
  }
}

/**
 * Generate an image with any catalogued fal model.
 * @param {{ modelId?: string, prompt: string, width?: number, height?: number, referenceUrls?: string[] }} opts
 * @returns {Promise<{ url: string, model: object }>}
 */
async function generateFalImage(opts) {
  const key = getFalCredentials();
  if (!key) throw new Error("FAL_API_KEY is not configured");

  const model = resolveModelOrDefault(opts.modelId);
  if (!model) throw new Error("Unknown model");

  const prompt = String(opts.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required");

  fal.config({ credentials: key });

  const input = buildInputForModel(model, {
    prompt,
    width: opts.width,
    height: opts.height,
    referenceUrls: opts.referenceUrls,
  });

  const result = await fal.subscribe(model.id, { input, logs: false });
  const url = result?.data?.images?.[0]?.url;
  if (!url || typeof url !== "string") {
    throw new Error("fal did not return an image URL");
  }
  return { url: url.trim(), model };
}

module.exports = { generateFalImage };
