import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  build: {
    sourcemap: false,
  },
  server: {
    proxy: {
      '/assistant':     { target: 'http://localhost:8000', changeOrigin: true },
      '/auth':          { target: 'http://localhost:8000', changeOrigin: true },
      '/catalog':       { target: 'http://localhost:8000', changeOrigin: true },
      '/submissions':   { target: 'http://localhost:8000', changeOrigin: true },
      '/clone-requests':{ target: 'http://localhost:8000', changeOrigin: true },
      '/clone':         { target: 'http://localhost:8000', changeOrigin: true },
      '/demo-requests': { target: 'http://localhost:8000', changeOrigin: true },
      '/admin':         { target: 'http://localhost:8000', changeOrigin: true },
      '/users':         { target: 'http://localhost:8000', changeOrigin: true },
      '/media':         { target: 'http://localhost:8000', changeOrigin: true },
      '/notifications': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':            { target: 'ws://localhost:8000',   changeOrigin: true, ws: true },
      '/health':        { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
