import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Unit tests for the rule math (src/**/*.test.ts) and a few screen/PDF tests
// (src/**/*.test.tsx, which run in a simulated page via jsdom). Kept separate
// from vite.config.ts so the PWA and Tailwind plugins don't load for tests.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
