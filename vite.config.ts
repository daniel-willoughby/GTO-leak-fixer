import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site is served under /<repo>/. Dev stays at root.
const BASE = '/GTO-leak-fixer/'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'build' ? BASE : '/'
  return {
    base,
    // bind all interfaces (IPv4 + IPv6) so localhost works everywhere and you
    // can open the dev server from a phone on the same network
    server: { host: true },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
        // The all-seats Freeplay dataset is large and fetched on demand, so keep
        // it out of the precache manifest (avoids the workbox size limit).
        workbox: { globIgnores: ['**/freeplay-nodes.json'] },
        manifest: {
          name: 'Leak Tutor, GTO Poker',
          short_name: 'LeakTutor',
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
    ],
  }
})
