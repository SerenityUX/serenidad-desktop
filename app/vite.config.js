import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DESKTOP_VERSION = require('./package.json').version;

const PROD_SERENIDAD_API =
  process.env.SERENIDAD_API_URL || 'https://api.serenidad.click';
// `npm run dev:web` boots the Express API on :3000 alongside Vite — point the
// renderer at it so chat/characters/etc. hit the local server in dev.
const DEV_SERENIDAD_API = process.env.SERENIDAD_API_URL || 'http://localhost:3000';

/**
 * Two targets, one config:
 *   `vite build` (or `vite` dev) → web SPA, served from `/`.
 *   `vite build --mode electron` → Electron renderer bundle, base `./` so
 *      `file://.../dist/index.html` resolves chunks/assets correctly.
 *
 * Both targets emit to `dist/`. The Electron main process loads
 * `dist/index.html`; the web target deploys `dist/` as static.
 *
 * `process.env.SERENIDAD_API_URL` is replaced at build time so existing
 * code in `src/config.js` keeps working without a Vite-specific rename.
 */
export default defineConfig(({ mode, command }) => {
  const isElectron = mode === 'electron';
  const isDevServe = command === 'serve';
  const apiUrl = isDevServe ? DEV_SERENIDAD_API : PROD_SERENIDAD_API;
  return {
    base: isElectron ? './' : '/',
    // Project uses .js for JSX files (not .jsx) — tell the React plugin to
    // process them and tell esbuild's prebundle / Rollup analyzer to treat
    // .js as JSX. Without all three flags Vite's import-analysis trips on
    // the first `<Component />` it sees in a .js file.
    plugins: [react({ include: /\.(js|jsx|ts|tsx)$/ })],
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: { '.js': 'jsx' },
      },
    },
    define: {
      'process.env.SERENIDAD_API_URL': JSON.stringify(apiUrl),
      'process.env.DESKTOP_VERSION': JSON.stringify(DESKTOP_VERSION),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    publicDir: 'public',
  };
});
