/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages currently serves this at bkumars22.github.io/mts/ (the
  // mts.chaitrishodaya.com DNS record isn't live yet) - change to '/' once
  // the custom domain resolves and Pages is switched to serve it at the root.
  base: '/mts/',
  test: {
    environment: 'jsdom',
  },
})
