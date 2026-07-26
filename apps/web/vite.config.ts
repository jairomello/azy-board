import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// `base: './'` gera paths relativos nos assets do build, o que permite
// publicar o app em path-based (ex.: /azyboard/) sem mudar o codigo.
// Em dev (`vite dev`) o base tambem vira "./", mas o servidor de dev escuta
// em /, entao nao quebra o uso local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'AZYBOARD_')
  const apiTarget = env.AZYBOARD_API_TARGET || 'http://localhost:3000'

  return {
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
      '/ws': { target: apiTarget, changeOrigin: true, ws: true },
    },
  },
  }
})
