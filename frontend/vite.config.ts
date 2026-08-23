/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // mts.chaitrishodaya.com is live and serves this at the domain root -
  // change back to '/mts/' only if this ever needs to serve from
  // bkumars22.github.io/mts/ again instead (they can't both be correct
  // with a single build, same tradeoff AIMO hit with its own custom domain).
  base: '/',
  test: {
    environment: 'jsdom',
  },
})
