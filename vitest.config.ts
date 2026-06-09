import { defineConfig } from 'vitest/config'

// Standalone test config (does not load the PWA plugin from vite.config).
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
})
