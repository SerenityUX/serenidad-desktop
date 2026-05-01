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
    label: "Nano Banana (Edit)",
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

const MODEL_BY_ID = new Map(FAL_IMAGE_MODELS.map((m) => [m.id, m]));

function getModel(id) {
  return MODEL_BY_ID.get(String(id || "")) || null;
}

function resolveModelOrDefault(id) {
  return getModel(id) || getModel(DEFAULT_MODEL_ID);
}

module.exports = {
  FAL_IMAGE_MODELS,
  DEFAULT_MODEL_ID,
  getModel,
  resolveModelOrDefault,
};
