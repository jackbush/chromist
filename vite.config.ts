import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Served from https://<user>.github.io/palette-builder/, so every asset URL
  // needs the repo name. Dev runs under the same path for parity.
  base: '/palette-builder/',
})
