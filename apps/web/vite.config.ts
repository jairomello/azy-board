import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

// `base: './'` gera paths relativos nos assets do build, o que permite
// publicar o app em path-based (ex.: /azyboard/) sem mudar o codigo.
// Em dev (`vite dev`) o base tambem vira "./", mas o servidor de dev escuta
// em /, entao nao quebra o uso local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'AZYBOARD_')
   const apiTarget = env.AZYBOARD_API_TARGET || 'http://localhost:3001'
  const basePath = env.AZYBOARD_BASE_PATH || './'
  // O relatório de bundle só é gerado com AZYBOARD_ANALYZE=1 (bun run build:analyze).
  // O build padrão permanece sem o plugin e sem artefatos extras.
  const analyze = env.AZYBOARD_ANALYZE === '1'

  return {
  base: basePath,
  plugins: [react(), ...(analyze ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, template: 'treemap' }) as PluginOption] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Espelha o paths do tsconfig para que imports de valor (não só `import type`)
      // resolvam no build; antes só existiam imports de tipo, apagados na compilação.
      '@azy-board/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none';",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
      '/ws': { target: apiTarget, changeOrigin: true, ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Nomes estáveis para os vendors pesados: o orçamento de bundle
        // (scripts/check-bundle.ts) casa por nome de chunk e precisa que eles
        // não migrem de arquivo a cada mudança.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) return 'vendor-query'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts'
          if (id.includes('@tiptap') || id.includes('prosemirror-')) return 'vendor-editor'
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react'
          return
        },
      },
    },
  },
  }
})
