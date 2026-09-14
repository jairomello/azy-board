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
import { usersRouter } from './routes/users'
import { batchRouter } from './routes/batch'
import { wsHandler } from './services/websocket'
import type { WsClientData } from './services/websocket'
import { hasGlobalGroup, verifyJwt } from './services/auth'
import { db } from './db/index'
import { and, eq } from 'drizzle-orm'
import { serve } from 'bun'
import { agentResponseMiddleware } from './middleware/agentResponse'
import { dashboardRouter } from './routes/dashboard'
import { assertAnalyticsCutoverReady } from './services/analytics'
import { assistantRouter } from './routes/assistant'
import { openApiDocument } from './validation'
import { classifyDatabaseError, errorResponseMiddleware, normalizeErrorPayload } from './middleware/errorResponse'

export const app = new Hono()

app.onError((error, c) => {
  // [INTEGRIDADE] Conflitos de constraint são erros de domínio, não erro interno.
  const classified = classifyDatabaseError(error)
  if (classified) {
    return c.json(normalizeErrorPayload({ code: classified.code, error: 'A operação conflita com o estado atual dos dados.' }, classified.status), classified.status)
  }
  // Não expor stack trace, SQL ou identificadores internos para clientes/agentes.
  console.error('Erro interno da API:', error instanceof Error ? error.message : 'erro desconhecido')
  return c.json(normalizeErrorPayload(null, 500), 500)
})

app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use('*', errorResponseMiddleware)

// Rotas públicas
app.route('/api/auth', authRouter)

// Rotas protegidas
const api = app.basePath('/api')
api.use('*', agentResponseMiddleware)
api.get('/openapi.json', (c) => c.json(openApiDocument()))
api.route('/projects', projectsRouter)
api.route('/projects/:projectId/columns', columnsRouter)
api.route('/projects/:projectId/sprints', sprintsRouter)
api.route('/projects/:projectId/tags', tagsRouter)
api.route('/projects/:projectId/items', itemsRouter)
api.route('/projects/:projectId/batch', batchRouter)
api.route('/projects/:projectId/items/:itemId/attachments', attachmentsRouter)
api.route('/projects/:projectId/items/:itemId/checklists', checklistsRouter)
api.route('/projects/:projectId/board.md', shadowMarkdownRouter)
api.route('/projects/:projectId/api-keys', apiKeysRouter)
api.route('/api-keys', userApiKeysRouter)
api.route('/projects/:projectId/versions', versionsRouter)
api.route('/users', usersRouter)
api.route('/projects/:projectId/dashboard', dashboardRouter)
api.route('/assistant', assistantRouter)

// [DB-SWAP] Para servir uploads em produção com S3, gerar URLs pré-assinadas no
// adapter e remover a rota de download local.
// [SECURITY] A rota estática /uploads/* foi removida: ela validava apenas o
// tenant no path e permitia acesso a anexos de projetos restritos por qualquer
// usuário autenticado do mesmo tenant. Anexos agora são servidos exclusivamente
// por /api/projects/:projectId/items/:itemId/attachments/:attachmentId/download,
// que valida membership, item, projeto e tenant e aplica Content-Disposition.

export async function startServer() {
  await assertAnalyticsCutoverReady()
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
          const [project, membership] = await Promise.all([
            db.query.projects.findFirst({
              where: (project) => and(eq(project.id, projectId), eq(project.tenantId, payload.tenantId)),
              columns: { id: true, isRestricted: true, managerUserId: true },
            }),
            db.query.memberships.findFirst({
              where: (m) => and(eq(m.projectId, projectId), eq(m.userId, payload.sub), eq(m.tenantId, payload.tenantId)),
              columns: { id: true },
            }),
          ])
          if (!project) return new Response('Projeto não encontrado', { status: 404 })
          // [TENANT] Projeto restrito exige vínculo/gerência; projeto público também
          // permite os grupos administrativos, em paridade com a API REST.
          const isManager = project.managerUserId === payload.sub
          const isGlobalAdmin = payload.globalGroup ? hasGlobalGroup(payload.globalGroup, 'ADMIN') : false
          if (!membership && !isManager && (project.isRestricted || !isGlobalAdmin)) return new Response('Projeto não encontrado', { status: 404 })
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
  return server
}

if (import.meta.main) startServer()
