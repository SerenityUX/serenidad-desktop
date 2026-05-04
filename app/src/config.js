/** Default deployed API (override with SERENIDAD_API_URL at build time). */
const FALLBACK_API_BASE = "https://api.serenidad.click";

export function apiUrl(path) {
  const raw = process.env.SERENIDAD_API_URL || FALLBACK_API_BASE;
  const base = String(raw).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
