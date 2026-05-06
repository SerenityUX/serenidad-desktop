/**
 * Catalog of visual styles a project can be locked to. The string is
 * appended to every generation prompt as `, <name> anime style.` to keep
 * the whole storyboard visually consistent.
 *
 * Mix of mainstream (Ghibli, Shinkai) and enthusiast picks (Moebius, Otomo,
 * Satoshi Kon, etc). Order roughly: most-recognized first.
 */
const PROJECT_STYLES = [
  { id: "ghibli", label: "Ghibli/Miyazaki", suffix: "Studio Ghibli / Miyazaki anime style" },
  { id: "shinkai", label: "Makoto Shinkai", suffix: "Makoto Shinkai anime style, lush atmospheric lighting" },
  { id: "kyoani", label: "Kyoto Animation", suffix: "Kyoto Animation anime style, soft expressive faces" },
  { id: "shonen", label: "Shōnen Ink", suffix: "shōnen manga ink anime style, dynamic linework" },
  { id: "90s-cel", label: "90s Cel Anime", suffix: "1990s cel-shaded anime style, painted backgrounds" },
  { id: "80s-ova", label: "80s OVA", suffix: "1980s OVA anime style, grainy film, neon highlights" },
  { id: "akira", label: "Otomo / Akira", suffix: "Katsuhiro Otomo / Akira anime style, cinematic detail" },
  { id: "kon", label: "Satoshi Kon", suffix: "Satoshi Kon anime style, surreal realism" },
  { id: "moebius", label: "Moebius", suffix: "Moebius / Jean Giraud comic style, clean line art, pastel palette" },
  { id: "klaus", label: "Klaus / SPA", suffix: "Klaus / SPA Studios animation style, 2D with painterly shading" },
  { id: "arcane", label: "Arcane", suffix: "Arcane animated series style, painterly textures" },
  { id: "trigger", label: "Studio Trigger", suffix: "Studio Trigger anime style, bold colors, kinetic energy" },
  { id: "ufotable", label: "Ufotable", suffix: "Ufotable anime style, cinematic composite lighting" },
  { id: "watercolor", label: "Watercolor Anime", suffix: "watercolor anime style, soft washes, paper texture" },
  { id: "ink-wash", label: "Sumi-e Ink Wash", suffix: "sumi-e ink wash anime style, monochrome, expressive brush" },
  { id: "chibi", label: "Chibi", suffix: "chibi anime style, soft pastel, oversized eyes" },
  { id: "cyberpunk", label: "Cyberpunk Anime", suffix: "cyberpunk anime style, neon-lit, gritty futuristic" },
  { id: "ligne-claire", label: "Ligne Claire", suffix: "ligne claire comic style, flat colors, clean outlines" },
];

const DEFAULT_STYLE_LABEL = "Ghibli/Miyazaki";

function resolveStyleSuffix(label) {
  if (!label) return null;
  const found = PROJECT_STYLES.find(
    (s) => s.label.toLowerCase() === String(label).toLowerCase(),
  );
  return found ? found.suffix : `${label} anime style`;
}

function isValidStyleLabel(label) {
  if (typeof label !== "string") return false;
  const t = label.trim();
  if (!t || t.length > 80) return false;
  return true;
}

module.exports = {
  PROJECT_STYLES,
  DEFAULT_STYLE_LABEL,
  resolveStyleSuffix,
  isValidStyleLabel,
};
