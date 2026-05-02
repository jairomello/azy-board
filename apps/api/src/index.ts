import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRouter } from './routes/auth'
import { projectsRouter } from './routes/projects'
import { columnsRouter } from './routes/columns'
import { sprintsRouter } from './routes/sprints'
import { tagsRouter } from './routes/tags'
import { itemsRouter } from './routes/items'
import { attachmentsRouter } from './routes/attachments'
import { checklistsRouter } from './routes/checklists'
import { shadowMarkdownRouter } from './routes/shadowMarkdown'
import { apiKeysRouter, userApiKeysRouter } from './routes/apiKeys'
import { versionsRouter } from './routes/versions'
import { wsHandler } from './services/websocket'
import { authMiddleware } from './middleware/auth'
import type { WsClientData } from './services/websocket'
import type { RequestContext } from '@azy-board/types'
import { verifyJwt } from './services/auth'
import { getCookie } from 'hono/cookie'
import { serve } from 'bun'

const app = new Hono()

app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))

// Rotas públicas
app.route('/api/auth', authRouter)

// Rotas protegidas
const api = app.basePath('/api')
api.route('/projects', projectsRouter)
api.route('/projects/:projectId/columns', columnsRouter)
api.route('/projects/:projectId/sprints', sprintsRouter)
api.route('/projects/:projectId/tags', tagsRouter)
api.route('/projects/:projectId/items', itemsRouter)
api.route('/projects/:projectId/items/:itemId/attachments', attachmentsRouter)
api.route('/projects/:projectId/items/:itemId/checklists', checklistsRouter)
api.route('/projects/:projectId/board.md', shadowMarkdownRouter)
api.route('/projects/:projectId/api-keys', apiKeysRouter)
api.route('/api-keys', userApiKeysRouter)
api.route('/projects/:projectId/versions', versionsRouter)

// [DB-SWAP] Para servir uploads em produção com S3, remover esta rota estática
// e usar URLs pré-assinadas do S3 diretamente
app.use('/uploads/*', authMiddleware, async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const filePath = c.req.path.replace('/uploads/', '')

  // [TENANT] Verifica que o primeiro segmento do path é o tenantId do usuário
  const pathParts = filePath.split('/')
  const fileTenantId = pathParts[0]
  if (fileTenantId !== ctx.tenantId) {
    return c.json({ error: 'Acesso negado' }, 403)
  }

  const file = Bun.file(`./uploads/${filePath}`)
  if (!(await file.exists())) return c.json({ error: 'Arquivo não encontrado' }, 404)

  return new Response(file)
})

const PORT = parseInt(process.env.PORT ?? '3000')

// WebSocket server nativo do Bun — sem dependências extras
// [DB-SWAP] Em produção com múltiplas instâncias, substituir o mapa em memória
// por Redis Pub/Sub para broadcast entre instâncias
const server = serve<WsClientData>({
  port: PORT,
  fetch: async (req, server) => {
    // Upgrade para WebSocket se solicitado
    if (req.headers.get('Upgrade') === 'websocket') {
      const url = new URL(req.url)
      const projectId = url.searchParams.get('projectId')
      if (!projectId) return new Response('projectId obrigatório', { status: 400 })

      // Autenticar antes de aceitar conexão WebSocket
      const cookieHeader = req.headers.get('cookie') ?? ''
      const token = cookieHeader.match(/session=([^;]+)/)?.[1]
      if (!token) return new Response('Não autorizado', { status: 401 })

      try {
        const payload = await verifyJwt(token)
        // [TENANT] tenantId armazenado na conexão WebSocket para isolamento de broadcast
        server.upgrade(req, {
          data: { projectId, tenantId: payload.tenantId, userId: payload.sub } satisfies WsClientData,
        })
        return undefined as unknown as Response
      } catch {
        return new Response('Token inválido', { status: 401 })
      }
    }

    return app.fetch(req, { server })
  },
  websocket: wsHandler(),
})

console.log(`🚀 Azy Board API rodando em http://localhost:${PORT}`)
