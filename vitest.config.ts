import { defineConfig } from 'vitest/config'

/**
 * Frontend unit/integration tests (auth phase batch).
 * Separate file so the production Vite/Tailwind build config stays clean.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
