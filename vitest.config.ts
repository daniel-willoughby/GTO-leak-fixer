import { defineConfig } from 'vitest/config'

// Standalone test config (does not load the PWA plugin from vite.config).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
