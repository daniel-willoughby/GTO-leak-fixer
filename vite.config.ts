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
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Leak Tutor — GTO Poker',
          short_name: 'LeakTutor',
          description: 'Find your poker leaks and fix them with GTO-based drills.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
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
