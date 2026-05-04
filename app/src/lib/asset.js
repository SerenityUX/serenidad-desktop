/**
 * Resolve a public/ asset path so it works in both Electron and web builds.
 *
 * Electron's `base` is `./` so relative URLs resolve against the document
 * (`dist/index.html`). The web build's base is `/` so paths must be rooted
 * — otherwise `./icons/foo.svg` rendered on `/project/:id` resolves to
 * `/project/icons/foo.svg` and 404s.
 *
 * Vite injects `import.meta.env.BASE_URL` per build, so prepending it gives
 * the right answer for whichever target we're in.
 */
export function asset(path) {
  const base = import.meta.env.BASE_URL || '/';
  const trimmed = String(path || '').replace(/^\.?\//, '');
  return `${base}${trimmed}`;
}
