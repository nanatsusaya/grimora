/**
 * Vite build/dev configuration for the `apps/web` offline-first PWA shell (ADR 0012 §1/§9).
 *
 * Why this exists: `apps/web` is the first *frontend* composition root (ADR 0003 §3) — a
 * client-rendered, installable, offline-capable PWA (no SSR of user data, ADR 0012 §1). Vite is the
 * build tool fixed by ADR 0002 (amended 2026-07-09 from Next.js to Vite + React). React is compiled by
 * `@vitejs/plugin-react-swc` (SWC, not Babel — deliberately, to keep the dependency tree shallow).
 *
 * Deliberately minimal for the scaffold (#105-A):
 *  - **PWA is hand-rolled**, not via `vite-plugin-pwa`/workbox: a static `public/manifest.webmanifest`
 *    plus a small `public/sw.js` (network-first app-shell, #131). The full workbox-based precaching setup is a
 *    follow-up — it pulls a deep `@babel/preset-env` tree that a scaffold does not need (and cannot link
 *    on Windows' MAX_PATH locally). A manifest + shell-caching SW already makes the shell installable and
 *    offline-loadable; robust asset precaching lands with the real offline data path (#105-B).
 *  - The **cross-origin-isolation headers (COOP/COEP)** the OPFS SQLite VFS needs are NOT set here yet —
 *    they arrive with the OPFS store driver + its Web Worker (#105-B).
 */
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // `@sqlite.org/sqlite-wasm` resolves its `.wasm` asset and its OPFS worker relative to its own module
  // via `import.meta.url`. Vite's dependency pre-bundling (esbuild) rewrites those URLs and breaks that
  // resolution, so the package must be excluded from optimization and served as native ESM (the SQLite
  // project's documented Vite setup). The OPFS SAHPool VFS needs no COOP/COEP headers (issue #105-B).
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});
