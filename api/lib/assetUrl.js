/**
 * Loose validation for stored asset pointers — URLs served over HTTP(S),
 * including presigned S3 URLs with query strings.
 */
function isProbablyAssetUrl(value) {
  if (typeof value !== "string") {
    return false;
  }
  const s = value.trim();
  if (!s) {
    return false;
  }
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

module.exports = { isProbablyAssetUrl };
