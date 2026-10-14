import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { readFileSync } from 'node:fs'
import path from 'node:path'

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

  // T60 — versão do build embutida no bundle. Prioridade: env injetada pelo
  // pipeline (vale também no build da imagem, onde não há .git) → .build-info.json
  // gerado por `bun run build:version` (dev local) → 'dev'.
  let appVersion = process.env.AZYBOARD_BUILD_VERSION || env.AZYBOARD_BUILD_VERSION || ''
  let buildDate = process.env.AZYBOARD_BUILD_DATE || env.AZYBOARD_BUILD_DATE || ''
  try {
    const parsed = JSON.parse(readFileSync(path.resolve(__dirname, '../../.build-info.json'), 'utf8')) as { version?: unknown; buildDate?: unknown }
    // O arquivo só preenche o que o pipeline não injetou: um .build-info.json
    // antigo que entre no contexto do build não pode sobrescrever a versão publicada.
    if (!appVersion && typeof parsed.version === 'string' && parsed.version) appVersion = parsed.version
    if (!buildDate && typeof parsed.buildDate === 'string') buildDate = parsed.buildDate
  } catch {
    // Sem .build-info.json (ex.: dev local): mantém o que veio do env.
  }
  if (!appVersion) appVersion = 'dev'

  return {
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [react(), ...(analyze ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, template: 'treemap' }) as PluginOption] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Espelha o paths do tsconfig para que imports de valor (não só `import type`)
      // resolvam no build; antes só existiam imports de tipo, apagados na compilação.
      '@azy-board/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@azy-board/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@azy-board/api-contracts': path.resolve(__dirname, '../../packages/api-contracts/src/index.ts'),
      '@azy-board/realtime-contracts': path.resolve(__dirname, '../../packages/realtime-contracts/src/index.ts'),
      '@azy-board/assistant-contracts': path.resolve(__dirname, '../../packages/assistant-contracts/src/index.ts'),
      '@azy-board/ui-contracts': path.resolve(__dirname, '../../packages/ui-contracts/src/index.ts'),
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
      // MCP remoto: sem o proxy, `/mcp` cairia no SPA em desenvolvimento e a URL
      // exibida na conta não funcionaria.
      '/mcp': { target: apiTarget, changeOrigin: true },
      // Versão do build (T60): a rota pública vive fora de /api; sem o proxy ela
      // cairia no SPA em desenvolvimento e o comportamento divergiria do deploy.
      '/version': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Nomes estáveis para os vendors pesados: o orçamento de bundle
        // (scripts/check-bundle.ts) casa por nome de chunk e precisa que eles
        // não migrem de arquivo a cada mudança.
        manualChunks(id) {
          // Catálogo de ícones (lucide) isolado em chunk próprio: é compartilhado por
          // várias telas e não deve inflar o chunk de entrada (orçamento "index").
          if (id.includes('iconCatalog')) return 'icons'
          if (!id.includes('node_modules')) return
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) return 'vendor-query'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts'
          if (id.includes('@tiptap') || id.includes('prosemirror-')) return 'vendor-editor'
          if (id.includes('marked') || id.includes('turndown')) return 'vendor-markdown'
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react'
          return
        },
      },
    },
  },
  }
})
