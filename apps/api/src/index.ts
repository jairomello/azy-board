import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRouter } from './routes/auth'
import { projectsRouter } from './routes/projects'
import { columnsRouter } from './routes/columns'
import { sprintsRouter } from './routes/sprints'
import { tagsRouter } from './routes/tags'
import { itemsRouter } from './routes/items'
import { attachmentSettingsRouter, attachmentsRouter } from './routes/attachments'
import { itemLinksRouter } from './routes/itemLinks'
import { checklistsRouter } from './routes/checklists'
import { shadowMarkdownRouter } from './routes/shadowMarkdown'
import { apiKeysRouter, userApiKeysRouter } from './routes/apiKeys'
import { versionsRouter } from './routes/versions'
import { usersRouter } from './routes/users'
import { batchRouter } from './routes/batch'
import { configureRealtimeAuthorizer, configureRealtimeBus, startHeartbeat, stopHeartbeat, wsHandler } from './services/websocket'
import type { WsClientData } from './services/websocket'
import { verifyJwt } from './services/auth'
import { authorizeProjectSubscription } from './services/wsAuthorization'
import { serve } from 'bun'
import { agentResponseMiddleware } from './middleware/agentResponse'
import { dashboardRouter } from './routes/dashboard'
import { planningGapsRouter } from './routes/planningGaps'
import { structureDuplicationRouter } from './routes/structureDuplication'
import { sprintTransitionRouter } from './routes/sprintTransition'
import { assistantRouter } from './routes/assistant'
import { openApiDocument } from './validation'
import { classifyDatabaseError, errorResponseMiddleware, normalizeErrorPayload } from './middleware/errorResponse'
import { clientIpMiddleware } from './middleware/clientIp'
import { requestObservabilityMiddleware } from './middleware/requestObservability'
import { securityHeadersMiddleware } from './middleware/securityHeaders'
import { otelMiddleware } from './middleware/otel'
import { configureReadinessProbes, healthRouter, runtimeReadinessProbes } from './routes/health'
import { operationsRouter } from './routes/operations'
import type { HonoEnv } from './types/hono'
import { startStorageCleanupWorker } from './services/storageCleanup'
import { startAgentWorker } from './services/agentWorker'
import { executeAssistantRun } from './services/assistantRunExecutor'
import { startDomainEventDispatcher, websocketDomainEventTransport } from './services/domainEventDispatcher'
import { createCoordinationEventTransport } from './services/realtimeBus'
import { WS_REPLAY_RETENTION_MS } from '@azy-board/realtime-contracts'
import { bootstrapRuntime } from './persistence/runtime'
import { resolveAgentWorkerMode } from './config/workerMode'
import { resolveObservabilityConfig } from './config/observability'
import { configureLogger, logger } from './services/logger'
import { initOpenTelemetry } from './services/telemetry'
import { createErrorTracker, type ErrorTracker } from './services/errorTracker'

export const app = new Hono<HonoEnv>()

// Configurar logger com variáveis de ambiente
const obsConfig = resolveObservabilityConfig()
configureLogger(obsConfig)

// Error tracker — inicializado em startServer
export let errorTracker: ErrorTracker = createErrorTracker(obsConfig)
let stopAgentWorker: (() => Promise<void>) | null = null
let stopStorageCleanup: (() => void) | null = null
let stopDomainEventDispatcher: (() => void) | null = null
let runtime: Awaited<ReturnType<typeof bootstrapRuntime>> | null = null
let serverHandle: ReturnType<typeof serve> | null = null

app.onError((error, c) => {
  // [INTEGRIDADE] Conflitos de constraint são erros de domínio, não erro interno.
  const classified = classifyDatabaseError(error)
  if (classified) {
    return c.json(normalizeErrorPayload({ code: classified.code, error: 'A operação conflita com o estado atual dos dados.' }, classified.status), classified.status)
  }
  // Não expor stack trace, SQL ou identificadores internos para clientes/agentes.
  const requestId = c.get('requestId')
  logger.error('Erro interno da API', {
    requestId,
    error: error instanceof Error ? error.message : 'erro desconhecido',
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  })

  // Capturar exceção no error tracker
  if (error instanceof Error) {
    errorTracker.captureException(error, { requestId })
  }

  return c.json(normalizeErrorPayload(null, 500), 500)
})

// Ordem de middlewares: security headers → observabilidade → CORS → errorResponse → clientIp
app.use('*', securityHeadersMiddleware)
app.use('*', requestObservabilityMiddleware)
app.use('*', otelMiddleware)
app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use('*', errorResponseMiddleware)
app.use('*', clientIpMiddleware)

// Rotas públicas
app.route('/health', healthRouter)
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
api.route('/projects/:projectId/items/:itemId/links', itemLinksRouter)
api.route('/tenant/attachments', attachmentSettingsRouter)
api.route('/projects/:projectId/items/:itemId/checklists', checklistsRouter)
api.route('/projects/:projectId/board.md', shadowMarkdownRouter)
api.route('/projects/:projectId/api-keys', apiKeysRouter)
api.route('/api-keys', userApiKeysRouter)
api.route('/projects/:projectId/versions', versionsRouter)
api.route('/users', usersRouter)
api.route('/projects/:projectId/dashboard', dashboardRouter)
api.route('/projects/:projectId/planning-gaps', planningGapsRouter)
api.route('/projects/:projectId/structure-duplication', structureDuplicationRouter)
api.route('/projects/:projectId/sprint-transition', sprintTransitionRouter)
api.route('/assistant', assistantRouter)
api.route('/operations', operationsRouter)

// [DB-SWAP] Para servir uploads em produção com S3, gerar URLs pré-assinadas no
// adapter e remover a rota de download local.
// [SECURITY] A rota estática /uploads/* foi removida: ela validava apenas o
// tenant no path e permitia acesso a anexos de projetos restritos por qualquer
// usuário autenticado do mesmo tenant. Anexos agora são servidos exclusivamente
// por /api/projects/:projectId/items/:itemId/attachments/:attachmentId/download,
// que valida membership, item, projeto e tenant e aplica Content-Disposition.

export async function startServer() {
  // Inicializar OpenTelemetry se configurado
  const obsConfig = resolveObservabilityConfig()
  await initOpenTelemetry(obsConfig)

  // Inicializar error tracker
  errorTracker = createErrorTracker(obsConfig)
  await errorTracker.init()

  // Composition root: valida configuração, marcadores e compõe persistência,
  // storage e coordenação ANTES de aceitar tráfego. Falha aqui não liga listener.
  runtime = await bootstrapRuntime()

  // [T38] Poda somente resultados idempotentes expirados (nunca PENDING).
  await runtime.persistence.idempotency.pruneExpired(new Date().toISOString())
  // [T38] Retenção de replay da outbox: remove apenas eventos confirmados com
  // mais de 24 h (WS_REPLAY_RETENTION_MS, alinhado ao contrato T39); contador
  // durável e pendências são preservados.
  await runtime.persistence.domainEvents.prunePublishedBefore(new Date(Date.now() - WS_REPLAY_RETENTION_MS).toISOString())
  await runtime.persistence.analytics.assertCutoverReady()
  // [TENANT] Backfill determinístico do rollup por projeto (idempotente: só
  // preenche projetos com cobertura e sem linhas). [DB-SWAP] PostgreSQL:
  // mover para job separado com refresh/materialized view.
  await runtime.persistence.analytics.backfillRollups()

  // Probes reais: banco limitado + storage + coordenação (obrigatória em ADVANCED).
  configureReadinessProbes(await runtimeReadinessProbes())

  // [T38]/[T39] Dispatcher da outbox de domínio: publica eventos confirmados com
  // a sequência durável. ADVANCED publica no barramento (CoordinationPort) e cada
  // instância assina as salas ativas; SIMPLE entrega local sem serviço externo.
  if (runtime.config.profile === 'ADVANCED') {
    configureRealtimeBus(runtime.coordination)
    stopDomainEventDispatcher = startDomainEventDispatcher({ transport: createCoordinationEventTransport(runtime.coordination), workerId: `api-${process.pid}` })
  } else {
    stopDomainEventDispatcher = startDomainEventDispatcher({ transport: websocketDomainEventTransport, workerId: `api-${process.pid}` })
  }

  // [T39] Revalidação de autorização das salas: o canal interno não substitui a
  // autorização REST; heartbeat e mudanças de membership reconferem o acesso.
  configureRealtimeAuthorizer(async data => {
    const decision = await authorizeProjectSubscription(
      { tenantId: data.tenantId, userId: data.userId, globalGroup: data.globalGroup ?? null },
      data.projectId,
    )
    return decision.ok
  })

  // Item 12: drena a fila de limpeza de storage no startup e em ciclo periódico
  // (backoff e FAILED são persistidos; index de intervalo é com unref, não
  // impede o processo de encerrar).
  stopStorageCleanup = startStorageCleanupWorker()
  // [T37] Consumo de runs por perfil: SIMPLE in-process; ADVANCED só via worker
  // SEPARATE (a API não consome). Configuração cruzada é recusada aqui.
  const workerMode = resolveAgentWorkerMode(runtime.config.profile)
  if (workerMode === 'IN_PROCESS') {
    if (!stopAgentWorker) stopAgentWorker = startAgentWorker({ executeRun: executeAssistantRun })
  } else {
    logger.info('agent-worker: consumo in-process desativado na API', { profile: runtime.config.profile, mode: workerMode })
  }
  const PORT = parseInt(process.env.PORT ?? '3000', 10)

  // WebSocket server nativo do Bun — sem dependências extras
  // [DB-SWAP] Em produção com múltiplas instâncias, substituir o mapa em memória
  // por Redis Pub/Sub para broadcast entre instâncias
  serverHandle = serve<WsClientData>({
    port: PORT,
    fetch: async (req, server) => {
      // Upgrade para WebSocket se solicitado
      if (req.headers.get('Upgrade') === 'websocket') {
        const url = new URL(req.url)
        const projectId = url.searchParams.get('projectId')
        if (!projectId) return new Response('projectId obrigatório', { status: 400 })
        // Cursor de replay: último sequence aplicado pelo cliente (ausente em cliente novo).
        const sinceParam = url.searchParams.get('since')
        const sinceCursor = sinceParam === null ? null : Number(sinceParam)
        // [T39] Negociação de protocolo: cliente declara a versão para o servidor
        // decidir replay versus refetch obrigatório de cursor legado. Cliente SEM
        // `protocol` que ainda envia cursor é tratado como legado (força refetch,
        // sem converter o cursor local em sequência global).
        const protocolParam = url.searchParams.get('protocol')
        const declaredProtocol = protocolParam === null ? null : Number(protocolParam)
        const protocolVersion = declaredProtocol === null && sinceCursor !== null ? 0 : declaredProtocol

        // Autenticar antes de aceitar conexão WebSocket
        const cookieHeader = req.headers.get('cookie') ?? ''
        const token = cookieHeader.match(/session=([^;]+)/)?.[1]
        if (!token) return new Response('Não autorizado', { status: 401 })

        try {
          const payload = await verifyJwt(token)
          // [TENANT] Autorização de upgrade via ports, com tenant/ator explícitos.
          const decision = await authorizeProjectSubscription(
            { tenantId: payload.tenantId, userId: payload.sub, globalGroup: payload.globalGroup },
            projectId,
          )
          if (!decision.ok) return new Response(decision.message, { status: decision.status })
          // [TENANT] tenantId armazenado na conexão WebSocket para isolamento de broadcast
          server.upgrade(req, {
            data: { projectId, tenantId: payload.tenantId, userId: payload.sub, globalGroup: payload.globalGroup ?? null, sinceCursor, protocolVersion } satisfies WsClientData,
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

  // Heartbeat do canal WebSocket (mantém conexões vivas e descarta zumbis).
  startHeartbeat()

  logger.info(`Azy Board API rodando em http://localhost:${PORT}`)
  return serverHandle
}

/**
 * Shutdown idempotente: para timers/listeners/workers do processo e fecha
 * coordenação/pool. Não afeta processos independentes (worker T37).
 */
export async function stopServer(): Promise<void> {
  stopHeartbeat()
  await stopAgentWorker?.()
  stopAgentWorker = null
  stopStorageCleanup?.()
  stopStorageCleanup = null
  stopDomainEventDispatcher?.()
  stopDomainEventDispatcher = null
  const current = serverHandle
  serverHandle = null
  await current?.stop(true)
  await runtime?.close()
  runtime = null
}

if (import.meta.main) {
  // Shutdown gracioso: para listener/timers/workers e fecha pool/coordenação.
  const shutdown = () => {
    void stopServer().finally(() => process.exit(0))
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  void startServer()
}
