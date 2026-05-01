/** Default deployed API (override with SERENIDAD_API_URL at build time). */
const FALLBACK_API_BASE =
  "http://iokwcc8o0s4cw4s48ockoc8g.5.78.111.174.sslip.io";

export function apiUrl(path) {
  const raw = process.env.SERENIDAD_API_URL || FALLBACK_API_BASE;
  const base = String(raw).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
