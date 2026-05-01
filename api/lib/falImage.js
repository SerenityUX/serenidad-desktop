const { fal } = require("@fal-ai/client");
const { aspectRatioForDimensions } = require("./falNanoBanana");
const { resolveModelOrDefault } = require("./falModels");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

/**
 * Returns the fal.ai endpoint id to call. Some families have a separate `/edit`
 * endpoint that accepts reference images; we auto-route there when refs exist.
 */
function endpointForCall(model, hasRefs) {
  if (!hasRefs) {
    if (model.id === "fal-ai/nano-banana/edit") return "fal-ai/nano-banana-2";
    return model.id;
  }
  switch (model.family) {
    case "nano-banana":
      if (model.id === "fal-ai/nano-banana-2") return "fal-ai/nano-banana-2/edit";
      if (model.id === "fal-ai/nano-banana") return "fal-ai/nano-banana/edit";
      return model.id;
    default:
      return model.id;
  }
}

function buildInput(endpointId, model, { prompt, width, height, referenceUrls }) {
  const aspect_ratio = aspectRatioForDimensions(width, height);
  const refs = Array.isArray(referenceUrls) ? referenceUrls.filter(Boolean) : [];

  if (endpointId.startsWith("fal-ai/nano-banana") && endpointId.endsWith("/edit")) {
    return {
      prompt,
      image_urls: refs,
      num_images: 1,
      aspect_ratio,
      output_format: "png",
    };
  }

  switch (model.family) {
    case "nano-banana": {
      return {
        prompt,
        num_images: 1,
        aspect_ratio,
        output_format: "png",
        resolution: "1K",
        limit_generations: true,
      };
    }
    case "flux-kontext": {
      const input = { prompt, num_images: 1, aspect_ratio, output_format: "png" };
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
 * @returns {Promise<{ url: string, model: object, endpoint: string }>}
 */
async function generateFalImage(opts) {
  const key = getFalCredentials();
  if (!key) throw new Error("FAL_API_KEY is not configured");

  const model = resolveModelOrDefault(opts.modelId);
  if (!model) throw new Error("Unknown model");

  const prompt = String(opts.prompt || "").trim();
  if (!prompt) throw new Error("prompt is required");

  fal.config({ credentials: key });

  const refs = Array.isArray(opts.referenceUrls) ? opts.referenceUrls.filter(Boolean) : [];
  const endpoint = endpointForCall(model, refs.length > 0);
  const input = buildInput(endpoint, model, {
    prompt,
    width: opts.width,
    height: opts.height,
    referenceUrls: refs,
  });

  const result = await fal.subscribe(endpoint, { input, logs: false });
  const url = result?.data?.images?.[0]?.url;
  if (!url || typeof url !== "string") {
    throw new Error("fal did not return an image URL");
  }
  return { url: url.trim(), model, endpoint };
}

module.exports = { generateFalImage };
