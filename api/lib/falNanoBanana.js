const { fal } = require("@fal-ai/client");

/** fal.ai aspect_ratio enum for nano-banana-2 */
const VALID_RATIOS = new Set([
  "auto",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "5:4",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "4:1",
  "1:4",
  "8:1",
  "1:8",
]);

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Map project pixel size to closest fal aspect_ratio string.
 * @see https://fal.ai/models/fal-ai/nano-banana-2/api
 */
function aspectRatioForDimensions(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return "auto";
  }
  const g = gcd(Math.round(w), Math.round(h));
  const rw = Math.round(w / g);
  const rh = Math.round(h / g);
  const forward = `${rw}:${rh}`;
  const backward = `${rh}:${rw}`;
  if (VALID_RATIOS.has(forward)) return forward;
  if (VALID_RATIOS.has(backward)) return backward;
  return "auto";
}

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

/**
 * @param {{ prompt: string, width?: number, height?: number }} opts
 * @returns {Promise<string>} HTTPS URL of first generated image
 */
async function generateNanoBananaImage(opts) {
  const key = getFalCredentials();
  if (!key) {
    throw new Error("FAL_API_KEY is not configured");
  }

  fal.config({ credentials: key });

  const prompt = String(opts.prompt || "").trim();
  if (!prompt) {
    throw new Error("prompt is required");
  }

  const aspect_ratio = aspectRatioForDimensions(opts.width, opts.height);

  const result = await fal.subscribe("fal-ai/nano-banana-2", {
    input: {
      prompt,
      num_images: 1,
      aspect_ratio,
      output_format: "png",
      resolution: "1K",
      limit_generations: true,
    },
    logs: false,
  });

  const url = result?.data?.images?.[0]?.url;
  if (!url || typeof url !== "string") {
    throw new Error("fal did not return an image URL");
  }
  return url.trim();
}

module.exports = {
  generateNanoBananaImage,
  aspectRatioForDimensions,
};
