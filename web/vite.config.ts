import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~backend': resolve(__dirname, '../src/lib/models'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/contract/**/*.test.{ts,tsx}'],
    exclude: ['tests/integration/**'],
  },
})
