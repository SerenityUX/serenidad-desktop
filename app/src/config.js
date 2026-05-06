/** Default deployed API (override with SERENIDAD_API_URL at build time). */
const FALLBACK_API_BASE = "https://api.serenidad.click";
const DEV_API_BASE = "http://localhost:3000";

export function apiUrl(path) {
  const raw = import.meta.env.DEV
    ? DEV_API_BASE
    : process.env.SERENIDAD_API_URL || FALLBACK_API_BASE;
  const base = String(raw).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
