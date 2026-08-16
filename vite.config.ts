import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { siteMeta } from './vite/site-meta'

export default defineConfig({
  plugins: [react(), siteMeta()],
  // Served from https://<user>.github.io/chromist/, so every asset URL needs
  // the repo name. Dev runs under the same path for parity.
  base: '/chromist/',
})
