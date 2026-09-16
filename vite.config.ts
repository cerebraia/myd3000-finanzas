import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  preview: {
    // SPA fallback: all routes serve index.html
    port: 4173,
  },
  build: {
    // Suppress the 500KB warning since we already use lazy routes
    chunkSizeWarningLimit: 600,
  },
})
