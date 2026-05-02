/**
 * Catalog of fal.ai image-generation models exposed to the editor.
 * costCents is the per-call price in US cents (rounded up). Token cost is 1 token = 1 cent.
 * supportsReferences: model accepts reference image URLs (image-to-image / edit / multi-ref).
 */
const FAL_IMAGE_MODELS = [
  {
    id: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    costCents: 4,
    supportsReferences: true,
    family: "nano-banana",
  },
  {
    id: "fal-ai/nano-banana/edit",
    label: "Nano Banana Edit",
    costCents: 4,
    supportsReferences: true,
    family: "nano-banana",
  },
  {
    id: "fal-ai/flux/schnell",
    label: "FLUX.1 [schnell]",
    costCents: 1,
    supportsReferences: false,
    family: "flux",
  },
  {
    id: "fal-ai/flux/dev",
    label: "FLUX.1 [dev]",
    costCents: 3,
    supportsReferences: false,
    family: "flux",
  },
  {
    id: "fal-ai/flux-pro/v1.1",
    label: "FLUX1.1 [pro]",
    costCents: 4,
    supportsReferences: false,
    family: "flux",
  },
  {
    id: "fal-ai/flux-pro/v1.1-ultra",
    label: "FLUX1.1 [pro] Ultra",
    costCents: 6,
    supportsReferences: false,
    family: "flux",
  },
  {
    id: "fal-ai/flux-pro/kontext",
    label: "FLUX Kontext [pro]",
    costCents: 4,
    supportsReferences: true,
    family: "flux-kontext",
  },
  {
    id: "fal-ai/ideogram/v2",
    label: "Ideogram V2",
    costCents: 8,
    supportsReferences: false,
    family: "ideogram",
  },
  {
    id: "fal-ai/recraft-v3",
    label: "Recraft V3",
    costCents: 4,
    supportsReferences: false,
    family: "recraft",
  },
  {
    id: "fal-ai/imagen3",
    label: "Imagen 3",
    costCents: 5,
    supportsReferences: false,
    family: "imagen",
  },
];

const DEFAULT_MODEL_ID = "fal-ai/nano-banana-2";

/**
 * Video models exposed for the "video frame" type. Frames flagged
 * `meta.kind === 'video'` use this catalog instead of the image one.
 * costCents is per-call; durations are in seconds.
 */
/**
 * Image-to-video endpoints on fal.ai. costCents is a rough per-call estimate;
 * tune as you measure real spend. Default endpoint is happy-horse, which
 * accepts a start frame, optional end frame, prompt, and duration.
 */
const FAL_VIDEO_MODELS = [
  {
    id: "fal-ai/happy-horse/image-to-video",
    label: "Happy Horse",
    costCents: 50,
    family: "happy-horse",
    defaultDuration: 4,
    supportsReferences: true,
  },
  {
    id: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    label: "Seedance 1.0 Pro",
    costCents: 60,
    family: "seedance",
    defaultDuration: 5,
    supportsReferences: true,
  },
  {
    id: "fal-ai/bytedance/seedance/v1/lite/image-to-video",
    label: "Seedance 1.0 Lite",
    costCents: 30,
    family: "seedance",
    defaultDuration: 5,
    supportsReferences: true,
  },
  {
    id: "fal-ai/kling-video/v2/master/image-to-video",
    label: "Kling 2.0 Master",
    costCents: 90,
    family: "kling",
    defaultDuration: 5,
    supportsReferences: true,
  },
  {
    id: "fal-ai/minimax/hailuo-02/standard/image-to-video",
    label: "Hailuo 02",
    costCents: 45,
    family: "minimax",
    defaultDuration: 6,
    supportsReferences: true,
  },
  {
    id: "fal-ai/wan/v2.2-a14b/image-to-video",
    label: "Wan 2.2",
    costCents: 40,
    family: "wan",
    defaultDuration: 5,
    supportsReferences: true,
  },
  {
    id: "fal-ai/luma-dream-machine/ray-2/image-to-video",
    label: "Luma Ray 2",
    costCents: 70,
    family: "luma",
    defaultDuration: 5,
    supportsReferences: true,
  },
];

const DEFAULT_VIDEO_MODEL_ID = "fal-ai/happy-horse/image-to-video";

/* Hidden aliases keep frames stored against retired ids resolvable without exposing them in the picker. */
const HIDDEN_ALIASES = [
  {
    id: "fal-ai/nano-banana/edit",
    label: "Nano Banana (Edit)",
    costCents: 4,
    supportsReferences: true,
    family: "nano-banana",
  },
];

const MODEL_BY_ID = new Map(
  [...FAL_IMAGE_MODELS, ...HIDDEN_ALIASES, ...FAL_VIDEO_MODELS].map((m) => [m.id, m]),
);

const VIDEO_MODEL_IDS = new Set(FAL_VIDEO_MODELS.map((m) => m.id));

function getModel(id) {
  return MODEL_BY_ID.get(String(id || "")) || null;
}

function resolveModelOrDefault(id) {
  return getModel(id) || getModel(DEFAULT_MODEL_ID);
}

function resolveVideoModelOrDefault(id) {
  const m = getModel(id);
  if (m && VIDEO_MODEL_IDS.has(m.id)) return m;
  return getModel(DEFAULT_VIDEO_MODEL_ID);
}

function isVideoModel(id) {
  return VIDEO_MODEL_IDS.has(String(id || ""));
}

module.exports = {
  FAL_IMAGE_MODELS,
  FAL_VIDEO_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  getModel,
  resolveModelOrDefault,
  resolveVideoModelOrDefault,
  isVideoModel,
};
