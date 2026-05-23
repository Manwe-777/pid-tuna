import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Tauri runs the desktop wrapper against this dev server (see src-tauri/tauri.conf.json
// `devUrl`). Tauri's webview is picky about ports and HMR — keep the port pinned and
// don't HMR-watch the Rust source tree.
// Set by `tauri dev` on mobile builds; undefined on desktop dev.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env;
const host = env?.TAURI_DEV_HOST;
// Base public path. Default "/" works for local dev, `pnpm preview`, and the
// Tauri wrappers (Tauri serves files from the protocol root). Override via
// VITE_BASE_PATH for project-page deploys, e.g. "/pid-tuna/" for GitHub Pages
// at Manwe-777.github.io/pid-tuna/.
const basePath = env?.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        // The blackbox-log WASM is base64-inlined into the main JS bundle, so
        // standard precaching of the build output is enough for full offline use.
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2}'],
        // App bundle is large (uPlot + Leaflet + WASM string); raise the cache cap.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'PIDTuna',
        short_name: 'PIDTuna',
        description:
          'Browser-based Betaflight blackbox log analysis: time-series, spectra, step response, latency, GPS track.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host ?? false,
    // Vite 5's dev server rejects requests whose Host header isn't in its allow
    // list, which kills /@vite/client (and the React refresh chain) when the
    // Tauri WKWebView reaches it under a non-standard host. Allow everything in
    // dev — this only affects local development.
    cors: true,
    allowedHosts: true,
    hmr: host
      ? { protocol: 'ws', host, port: 5174 }
      : undefined,
    watch: {
      // Don't try to HMR-reload Rust source files.
      ignored: ['**/src-tauri/**'],
    },
    open: false,
  },
});
