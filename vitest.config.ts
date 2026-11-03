import { defineConfig } from 'vitest/config'
import path from 'path'

// Unit tests for the rule math (src/**/*.test.ts). Kept separate from
// vite.config.ts so the PWA and Tailwind plugins don't load for tests.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'] },
})
