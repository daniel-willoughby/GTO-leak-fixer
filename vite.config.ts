import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site is served under /<repo>/. Dev stays at root.
const BASE = '/GTO-leak-fixer/'

// Native (Capacitor) builds serve from a local bundle at the webview root and
// must NOT register a service worker. `CAP=1 vite build` switches to that mode;
// the normal web build keeps the GitHub Pages base + PWA untouched.
const NATIVE = process.env.CAP === '1'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'build' && !NATIVE ? BASE : '/'
  return {
    base,
    // Native builds disable the PWA plugin, so stub out its virtual module that
    // PwaUpdater imports (it's a no-op in the webview).
    resolve: NATIVE
      ? { alias: { 'virtual:pwa-register/react': fileURLToPath(new URL('./src/pwa-register-stub.ts', import.meta.url)) } }
      : undefined,
    // bind all interfaces (IPv4 + IPv6) so localhost works everywhere and you
    // can open the dev server from a phone on the same network
    server: { host: true },
    plugins: [
      react(),
      // Skip the PWA service worker entirely in native builds.
      ...(NATIVE ? [] : [
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
        // The all-seats Freeplay dataset and the rich postflop shards are large
        // and fetched on demand, so keep them out of the precache manifest (a
        // fresh install must not force a ~30MB download). The postflop corpus
        // (street-nodes) is bundled into the main chunk and IS a core offline
        // feature, so bump the precache size limit to fit it (~4.7 MB chunk).
        // Shards cache at runtime instead: fetched once, then served locally.
        workbox: {
          globIgnores: ['**/freeplay-nodes.json', '**/postflop-shards/**', '**/postflop-shards-web/**'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /postflop-shards(-web)?\/.*\.json$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'postflop-shards',
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 24 * 60 * 60 },
              },
            },
          ],
        },
        manifest: {
          name: 'PotKing, GTO Poker',
          short_name: 'PotKing',
          description: 'Find your poker leaks and fix them with GTO-based drills.',
          theme_color: '#f5f2ea',
          background_color: '#f5f2ea',
          display: 'standalone',
          id: base,
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
      ]),
    ],
  }
})
