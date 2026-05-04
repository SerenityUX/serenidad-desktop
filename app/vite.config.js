import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const DEFAULT_SERENIDAD_API =
  process.env.SERENIDAD_API_URL ||
  'http://iokwcc8o0s4cw4s48ockoc8g.5.78.111.174.sslip.io';

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
export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron';
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
      'process.env.SERENIDAD_API_URL': JSON.stringify(DEFAULT_SERENIDAD_API),
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
