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
 * Image-to-video endpoints on fal.ai.
 *
 * `supportsEndFrame` records whether the model interpolates between a start
 * and end image; when true, `endFrameKey` is the exact input field name the
 * model expects (this varies by family — Seedance/Luma use `end_image_url`,
 * Kling uses `tail_image_url`, Pixverse uses `last_image_url`).
 *
 * Models with `supportsEndFrame: false` are pure i2v: they take only the
 * first image and the prompt. Sending an end frame to these models silently
 * drops it, so we do not. The frontend should pick (or hint at) an
 * end-frame-capable model when 2+ references are attached.
 */
const FAL_VIDEO_MODELS = [
  {
    id: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    label: "Seedance 1.0 Pro",
    costCents: 60,
    family: "seedance",
    defaultDuration: 5,
    supportsReferences: true,
    supportsEndFrame: true,
    endFrameKey: "end_image_url",
  },
  {
    id: "fal-ai/bytedance/seedance/v1/lite/image-to-video",
    label: "Seedance 1.0 Lite",
    costCents: 30,
    family: "seedance",
    defaultDuration: 5,
    supportsReferences: true,
    supportsEndFrame: true,
    endFrameKey: "end_image_url",
  },
  {
    id: "fal-ai/kling-video/v2/master/image-to-video",
    label: "Kling 2.0 Master",
    costCents: 90,
    family: "kling",
    defaultDuration: 5,
    supportsReferences: true,
    supportsEndFrame: true,
    endFrameKey: "tail_image_url",
  },
  {
    id: "fal-ai/kling-video/v1.6/pro/image-to-video",
    label: "Kling 1.6 Pro",
    costCents: 50,
    family: "kling",
    defaultDuration: 5,
    supportsReferences: true,
    supportsEndFrame: true,
    endFrameKey: "tail_image_url",
  },
  {
    id: "fal-ai/luma-dream-machine/ray-2/image-to-video",
    label: "Luma Ray 2",
    costCents: 70,
    family: "luma",
    defaultDuration: 5,
    supportsReferences: true,
    supportsEndFrame: true,
    endFrameKey: "end_image_url",
  },
  {
    id: "fal-ai/pixverse/v4.5/image-to-video",
    label: "Pixverse 4.5",
    costCents: 35,
    family: "pixverse",
    defaultDuration: 5,
    supportsReferences: true,
    supportsEndFrame: true,
    endFrameKey: "last_image_url",
  },
  {
    // Reference-to-video: array of refs all condition the output. Used when
    // shift-selecting multiple frames and tapping "Make Video Frame".
    // Docs: https://fal.ai/models/alibaba/happy-horse/reference-to-video
    id: "alibaba/happy-horse/reference-to-video",
    label: "Happy Horse (reference-to-video)",
    costCents: 50,
    family: "happy-horse",
    defaultDuration: 4,
    supportsReferences: true,
    supportsEndFrame: false,
    referenceImagesKey: "image_urls",
  },
  {
    // Plain image-to-video: single start image + prompt → animation. Used
    // when you tap "Convert to Video" on one frame.
    // Docs: https://fal.ai/models/alibaba/happy-horse/image-to-video/playground
    id: "alibaba/happy-horse/image-to-video",
    label: "Happy Horse (image-to-video)",
    costCents: 50,
    family: "happy-horse",
    defaultDuration: 4,
    supportsReferences: true,
    supportsEndFrame: false,
  },
  {
    id: "fal-ai/minimax/hailuo-02/standard/image-to-video",
    label: "Hailuo 02 (start frame only)",
    costCents: 45,
    family: "minimax",
    defaultDuration: 6,
    supportsReferences: true,
    supportsEndFrame: false,
  },
  {
    id: "fal-ai/wan/v2.2-a14b/image-to-video",
    label: "Wan 2.2 (start frame only)",
    costCents: 40,
    family: "wan",
    defaultDuration: 5,
    supportsReferences: true,
    supportsEndFrame: false,
  },
];

// Default for new video frames — Happy Horse (reference-to-video) accepts an
// array of references and conditions the whole clip on them, which matches
// the shift-select-N-frames-then-Make-Video-Frame flow.
const DEFAULT_VIDEO_MODEL_ID = "alibaba/happy-horse/reference-to-video";

/* Hidden aliases keep frames stored against retired ids resolvable without exposing them in the picker. */
const HIDDEN_ALIASES = [
  {
    id: "fal-ai/nano-banana/edit",
    label: "Nano Banana (Edit)",
    costCents: 4,
    supportsReferences: true,
    family: "nano-banana",
  },
  {
    // Legacy id used before the alibaba namespace was discovered. Routes to
    // the real image-to-video endpoint so old frames still resolve.
    id: "fal-ai/happy-horse/image-to-video",
    label: "Happy Horse (legacy)",
    costCents: 50,
    family: "happy-horse",
    defaultDuration: 4,
    supportsReferences: true,
    supportsEndFrame: false,
    aliasOf: "alibaba/happy-horse/image-to-video",
  },
];

const MODEL_BY_ID = new Map(
  [...FAL_IMAGE_MODELS, ...HIDDEN_ALIASES, ...FAL_VIDEO_MODELS].map((m) => [m.id, m]),
);

// Include legacy aliases that point at video models so old frame rows still
// resolve as video frames.
const VIDEO_MODEL_IDS = new Set([
  ...FAL_VIDEO_MODELS.map((m) => m.id),
  ...HIDDEN_ALIASES.filter((a) => a.aliasOf && FAL_VIDEO_MODELS.some((v) => v.id === a.aliasOf)).map((a) => a.id),
]);

function getModel(id) {
  const m = MODEL_BY_ID.get(String(id || ""));
  if (!m) return null;
  // Follow aliases to the canonical model entry so callers always see the
  // current id and current parameter shape.
  if (m.aliasOf) {
    const target = MODEL_BY_ID.get(m.aliasOf);
    if (target) return target;
  }
  return m;
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
