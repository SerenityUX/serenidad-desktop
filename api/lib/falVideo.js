const { fal } = require("@fal-ai/client");
const { resolveVideoModelOrDefault } = require("./falModels");

function getFalCredentials() {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || "";
}

/**
 * Build the input payload for a fal video model.
 *
 * - First reference is always the start frame (`image_url`).
 * - Last reference (when 2+ refs are passed) is the end frame, written under
 *   the model-specific key declared in the catalog (`endFrameKey`). For models
 *   that do not support an end frame this key is omitted entirely — passing
 *   unknown fields is silently ignored on permissive endpoints and rejected on
 *   strict ones, so we just don't send it.
 * - Prompt and duration are passed through unchanged; the prompt is what the
 *   model uses to plan the motion that connects the two frames.
 */
function buildVideoInput(model, { prompt, durationSeconds, referenceUrls }) {
  const refs = Array.isArray(referenceUrls) ? referenceUrls.filter(Boolean) : [];
  const duration = Math.max(1, Math.min(30, Number(durationSeconds) || 4));
  const input = { prompt, duration };

  // Reference-to-video models (e.g. Happy Horse) take an array of refs at a
  // single field and ignore start/end semantics. Send all refs through that.
  if (model.referenceImagesKey) {
    if (refs.length > 0) input[model.referenceImagesKey] = refs;
    return input;
  }

  // Image-to-video shape: first ref is the start frame; last ref (if any) is
  // the end frame, written under the model-specific key the catalog declares.
  if (refs[0]) input.image_url = refs[0];
  const endRef = refs.length > 1 ? refs[refs.length - 1] : null;
  if (endRef && model.supportsEndFrame && model.endFrameKey) {
    input[model.endFrameKey] = endRef;
  }
  return input;
}

/**
 * Generate a video clip with a fal video model. Returns the mp4 URL.
 * @param {{ modelId?: string, prompt: string, durationSeconds?: number,
 *           referenceUrls: string[] }} opts
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

  let result;
  try {
    result = await fal.subscribe(model.id, { input, logs: false });
  } catch (err) {
    // The fal client wraps validation errors in an object with `body.detail`
    // listing per-field problems. Surface that text so the editor can show
    // exactly which input field the model didn't accept.
    const detail = err?.body?.detail;
    let detailText = "";
    if (Array.isArray(detail)) {
      detailText = detail
        .map((d) => {
          const loc = Array.isArray(d?.loc) ? d.loc.join(".") : "";
          return loc ? `${loc}: ${d.msg || d.type}` : (d.msg || JSON.stringify(d));
        })
        .join("; ");
    } else if (typeof detail === "string") {
      detailText = detail;
    } else if (detail && typeof detail === "object") {
      detailText = JSON.stringify(detail);
    }
    const baseMsg = err?.message || "fal generation failed";
    const status = err?.status ? ` (HTTP ${err.status})` : "";
    const sentKeys = Object.keys(input).join(", ");
    console.error("fal video error", { model: model.id, sentKeys, status: err?.status, detail });
    throw new Error(
      detailText
        ? `${baseMsg}${status}: ${detailText}`
        : `${baseMsg}${status}`,
    );
  }

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
