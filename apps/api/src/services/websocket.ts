import type { ServerWebSocket } from 'bun'
import type { GlobalGroup } from '@azy-board/domain'
import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_LIVE_BUFFER_MAX,
  WS_MIN_SUPPORTED_PROTOCOL_VERSION,
  WS_REPLAY_MAX_EVENTS,
  WS_SCHEMA_VERSION,
  isControlMessage,
  type ResyncReason,
  type WsControlMessage,
  type WsEvent,
  type WsEventInput,
  type WsServerMessage,
} from '@azy-board/realtime-contracts'
import { mapDomainEventToWs } from '../persistence/domainEvents'
import type { CoordinationPort } from '../coordination/ports'
import { projectRoomKey } from './realtimeKeys'
import { parseBusEnvelope, projectChannel } from './realtimeBus'
import {
  recordRealtimeDedup,
  recordRealtimeGap,
  recordRealtimeLag,
  recordRealtimeRefetchConfirmed,
  recordRealtimeResync,
} from './realtimeMetrics'

// Mapa de conexões WebSocket agrupadas por chave composta tenant/projeto.
// [TENANT] As conexões já chegam autenticadas com tenantId — o isolamento é
// reforçado pela própria chave da sala, não apenas pela autenticação.
interface ProjectRoom {
  tenantId: string
  projectId: string
  clients: Set<ServerWebSocket<WsClientData>>
  // [T39] Cleanup da assinatura do barramento da sala (ADVANCED). Ausente em
  // SIMPLE, onde a entrega é local/in-process.
  unsubscribe?: () => Promise<void>
}

const rooms = new Map<string, ProjectRoom>()

// [T39] Estado de consumo por tenant/projeto. A sequência/identidade vêm da
// outbox T38 (nunca alocadas localmente); aqui só rastreamos o progresso de
// entrega para deduplicar e conservar ordem contígua.
// [DB-SWAP] Em múltiplas instâncias o estado é local a cada API; o SQL/outbox é
// a verdade e a comparação de watermark recom compõe após restart.
interface ProjectReplayState {
  // Maior sequence durável conhecida (referência de watermark local).
  sequence: number
  // Última sequence entregue em ordem à sala.
  delivered: number
  // eventIds recentes entregues (dedup de republicação/replay). Limitado.
  seen: Set<string>
  // Eventos fora de ordem aguardando a lacuna fechar (buffer limitado).
  pending: Map<number, { message: string; eventId?: string }>
  // Single-flight da recuperação de lacuna via SQL.
  filling: boolean
}

const replayState = new Map<string, ProjectReplayState>()

export interface WsClientData {
  projectId: string
  tenantId: string  // [TENANT] armazenado na conexão para filtros de broadcast
  userId: string
  // [TENANT] Grupo global do ator, usado na revalidação de autorização da sala.
  globalGroup?: GlobalGroup | null
  // Cursor informado pelo cliente no handshake (query param `since`).
  sinceCursor: number | null
  // [T39] Versão de protocolo declarada pelo cliente no handshake; null em
  // clientes legados que só enviam `since`.
  protocolVersion: number | null
  // [T39] Token da barreira de refetch pendente para esta conexão; `REFETCH_COMPLETE`
  // só é aceito quando o token confere (descarta confirmações de geração antiga).
  refetchToken?: string | null
}

function stateOf(tenantId: string, projectId: string): ProjectReplayState {
  const key = projectRoomKey(tenantId, projectId)
  let state = replayState.get(key)
  if (!state) {
    state = { sequence: 0, delivered: 0, seen: new Set(), pending: new Map(), filling: false }
    replayState.set(key, state)
  }
  return state
}

// [T39] Barramento opcional entre instâncias. Em ADVANCED, cada API assina os
// canais das salas ativas e entrega localmente (inclusive a própria origem). Em
// SIMPLE permanece null: a entrega é local/in-process, sem serviço externo e
// sem publicação duplicada de rota.
let bus: CoordinationPort | null = null

// [T39] Saúde do subscriber do barramento: alimenta readiness em ADVANCED.
// SIMPLE não usa barramento e permanece saudável por definição.
let subscriberHealthy = true

export function configureRealtimeBus(port: CoordinationPort | null): void {
  bus = port
  subscriberHealthy = true
}

/** [T39] Readiness: false quando a assinatura do barramento falhou (ADVANCED). */
export function isRealtimeSubscriberHealthy(): boolean {
  return bus === null || subscriberHealthy
}

// [T39] Assina o canal tenant/projeto da sala (idempotente por sala). O handler
// valida o envelope e o escopo antes de entregar; falha de assinatura degrada a
// readiness e é recomposta no próximo ciclo (o SQL/outbox é a verdade).
async function subscribeRoom(room: ProjectRoom): Promise<void> {
  if (!bus || room.unsubscribe) return
  const { tenantId, projectId } = room
  try {
    room.unsubscribe = await bus.subscribe(projectChannel(tenantId, projectId), raw => {
      const envelope = parseBusEnvelope(raw)
      if (!envelope) return
      if (envelope.tenantId !== tenantId || envelope.projectId !== projectId) return
      publishDurableEvent(
        tenantId,
        projectId,
        envelope.sequence,
        { projectId, type: envelope.type, payload: envelope.payload },
        { eventId: envelope.eventId, schemaVersion: envelope.schemaVersion },
      )
    })
    subscriberHealthy = true
    // Recupera eventual última mensagem perdida enquanto não havia assinatura.
    void recoverRoom(tenantId, projectId)
  } catch {
    // Sem assinatura: mantém a sala e degrada readiness; reconciliação por
    // watermark/replay recompõe quando a assinatura voltar.
    subscriberHealthy = false
  }
}

function teardownRoom(room: ProjectRoom): void {
  const cleanup = room.unsubscribe
  room.unsubscribe = undefined
  if (cleanup) void cleanup().catch(() => { /* já encerrado */ })
}

// [T39] Revalidação de autorização: o canal interno NÃO é autorização. A cada
// heartbeat (e ao mudar membership) cada conexão da sala é reconferida contra a
// autorização REST atual; acesso revogado é cortado sem vazar eventos.
type RoomAuthorizer = (data: WsClientData) => Promise<boolean>

let authorizer: RoomAuthorizer | null = null

export function configureRealtimeAuthorizer(fn: RoomAuthorizer | null): void {
  authorizer = fn
}

async function revalidateRoom(key: string, room: ProjectRoom): Promise<void> {
  if (!authorizer) return
  for (const client of [...room.clients]) {
    let allowed = true
    try {
      allowed = await authorizer(client.data)
    } catch {
      // Erro transitório: mantém a conexão e revalida no próximo ciclo.
      allowed = true
    }
    if (!allowed) {
      try { client.close() } catch { /* já fechado */ }
      room.clients.delete(client)
    }
  }
  if (room.clients.size === 0) {
    teardownRoom(room)
    rooms.delete(key)
  }
}

// Aciona revalidação imediata de uma sala (ex.: evento de membership).
function revalidateRoomSoon(tenantId: string, projectId: string): void {
  if (!authorizer) return
  const key = projectRoomKey(tenantId, projectId)
  const room = rooms.get(key)
  if (room) void revalidateRoom(key, room)
}

// Mensagem de controle do canal (heartbeat, replay e ressincronização).
// [T39] Campos aditivos (watermark/reason/token/schemaVersion) são opcionais e
// só entram quando fazem sentido para o tipo, preservando clientes legados.
export function controlMessage(
  projectId: string,
  type: WsControlMessage['type'],
  sequence = 0,
  extra: Partial<Pick<WsControlMessage, 'watermark' | 'reason' | 'token' | 'schemaVersion'>> = {},
): WsControlMessage {
  return { kind: 'control', type, projectId, sequence, ...extra }
}

// Resultado do handshake de replay para um cursor informado pelo cliente.
export type ReplayPlan =
  | { kind: 'replay'; messages: string[]; currentSequence: number }
  | { kind: 'resync'; reason: ResyncReason; watermark: number }

// Token de barreira de reconciliação: correlaciona o RESYNC_REQUIRED com a
// confirmação REFETCH_COMPLETE do cliente e descarta respostas de geração
// anterior após troca de conexão/projeto.
export function reconciliationToken(): string {
  return crypto.randomUUID()
}

// Envia o handshake de replay/resincronização para um cliente recém-conectado.
// [T38] Replay DURÁVEL a partir da outbox: sobrevive a restart e usa a sequência
// confirmada; gap/retenção excedida exige RESYNC (refetch do cliente).
// [T39] Cursor/protocolo legado incompatível com a sequência global também exige
// RESYNC (reason `legacy`), sem tentar converter o número local. Retorna o
// watermark aplicado ao cliente (para alinhar a entrega contígua da sala).
export async function durableReplayPlan(
  tenantId: string,
  projectId: string,
  since: number | null,
  protocolVersion: number | null = null,
): Promise<ReplayPlan> {
  const { persistence } = await import('../persistence/runtime')
  const watermark = await persistence.domainEvents.watermark(tenantId, projectId)
  if (protocolVersion !== null && Number.isInteger(protocolVersion) && protocolVersion < WS_MIN_SUPPORTED_PROTOCOL_VERSION) {
    return { kind: 'resync', reason: 'legacy', watermark }
  }
  if (since === null) return { kind: 'replay', messages: [], currentSequence: watermark }
  if (!Number.isInteger(since) || since < 0) return { kind: 'resync', reason: 'invalid', watermark }
  if (since > watermark) return { kind: 'resync', reason: 'cursor-ahead', watermark }
  if (since === watermark) return { kind: 'replay', messages: [], currentSequence: watermark }

  // Limite de reconciliação (WS_REPLAY_MAX_EVENTS, alinhado a T38): acima disso
  // exige refetch, sem truncar.
  const events = await persistence.domainEvents.listAfter({ tenantId, projectId, cursor: since, limit: WS_REPLAY_MAX_EVENTS + 1 })
  if (events.length > WS_REPLAY_MAX_EVENTS) return { kind: 'resync', reason: 'overflow', watermark }
  if (events.length === 0 || events[0]!.sequence > since + 1) return { kind: 'resync', reason: 'gap', watermark }

  const messages: string[] = []
  for (const event of events) {
    const mapped = mapDomainEventToWs(event.type, event.payload)
    if (!mapped) return { kind: 'resync', reason: 'gap', watermark }
    messages.push(JSON.stringify({ projectId, sequence: event.sequence, type: mapped.type, payload: mapped.payload, eventId: event.id, schemaVersion: event.schemaVersion }))
  }
  // Cobertura até o watermark: replay parcial (eventos podados no meio) não pode
  // ser tratado como completo.
  if (events[events.length - 1]!.sequence !== watermark) return { kind: 'resync', reason: 'gap', watermark }
  return { kind: 'replay', messages, currentSequence: watermark }
}

async function sendReplayPlan(ws: ServerWebSocket<WsClientData>): Promise<number> {
  const { projectId, tenantId, sinceCursor, protocolVersion } = ws.data
  let plan: ReplayPlan
  try {
    plan = await durableReplayPlan(tenantId, projectId, sinceCursor, protocolVersion)
  } catch {
    plan = { kind: 'resync', reason: 'gap', watermark: 0 }
  }
  if (plan.kind === 'resync') {
    const token = reconciliationToken()
    ws.data.refetchToken = token
    ws.send(JSON.stringify(controlMessage(projectId, 'RESYNC_REQUIRED', 0, {
      reason: plan.reason,
      watermark: plan.watermark,
      token,
      schemaVersion: WS_SCHEMA_VERSION,
    })))
    return plan.watermark
  }
  for (const message of plan.messages) ws.send(message)
  ws.send(JSON.stringify(controlMessage(projectId, 'REPLAY_COMPLETE', plan.currentSequence, { watermark: plan.currentSequence, schemaVersion: WS_SCHEMA_VERSION })))
  return plan.currentSequence
}

export function wsHandler() {
  return {
    async open(ws: ServerWebSocket<WsClientData>) {
      const { tenantId, projectId } = ws.data
      const key = projectRoomKey(tenantId, projectId)
      let room = rooms.get(key)
      if (!room) {
        room = { tenantId, projectId, clients: new Set() }
        rooms.set(key, room)
      }
      room.clients.add(ws)
      // [T39] Assinatura do barramento (ADVANCED) antes do handshake de replay.
      await subscribeRoom(room)
      // Handshake de replay: cursor vindo do query param `since` do upgrade.
      const watermark = await sendReplayPlan(ws)
      // Alinha a entrega contígua da sala ao watermark já reconciliado, para que
      // os próximos eventos confirmados sejam tratados como contíguos.
      const state = stateOf(tenantId, projectId)
      state.sequence = Math.max(state.sequence, watermark)
      state.delivered = Math.max(state.delivered, watermark)
    },

    close(ws: ServerWebSocket<WsClientData>) {
      const { tenantId, projectId } = ws.data
      const key = projectRoomKey(tenantId, projectId)
      const room = rooms.get(key)
      if (!room) return
      room.clients.delete(ws)
      if (room.clients.size === 0) {
        teardownRoom(room)
        rooms.delete(key)
      }
    },

    message(ws: ServerWebSocket<WsClientData>, msg: string | Buffer) {
      // Toda mutação vem via API REST; clientes só enviam controles.
      try {
        const parsed = JSON.parse(String(msg)) as WsServerMessage
        if (!isControlMessage(parsed)) return
        // [T39] Confirmação da barreira de refetch: só aceita token pendente
        // desta conexão (confirmação de geração antiga é descartada).
        if (parsed.type === 'REFETCH_COMPLETE' && ws.data.refetchToken && parsed.token === ws.data.refetchToken) {
          ws.data.refetchToken = null
          recordRealtimeRefetchConfirmed()
        }
      } catch {
        // Mensagem inválida — ignorar
      }
    },
  }
}

// Entrega a mensagem aos clientes da sala, descartando peers mortos e
// removendo a sala quando ela esvazia.
function sendToRoom(key: string, message: string): void {
  const room = rooms.get(key)
  if (!room || room.clients.size === 0) return
  for (const client of room.clients) {
    try {
      client.send(message)
    } catch {
      // Cliente morto — descartar imediatamente
      try { client.close() } catch { /* já fechado */ }
      room.clients.delete(client)
    }
  }
  if (room.clients.size === 0) rooms.delete(key)
}

// Dedup de eventId em janela limitada (menor FIFO): evita reaplicar
// republicações/replay sem crescer indefinidamente.
function rememberSeen(state: ProjectReplayState, eventId: string): void {
  state.seen.add(eventId)
  if (state.seen.size > WS_LIVE_BUFFER_MAX) {
    const oldest = state.seen.values().next().value
    if (oldest !== undefined) state.seen.delete(oldest)
  }
}

// Entrega contígua: publica a mensagem e drena o buffer de pendências enquanto
// houver a próxima sequence, mantendo a ordem global sem encaminhar buracos.
function deliverContiguous(
  key: string,
  state: ProjectReplayState,
  sequence: number,
  message: string,
  eventId?: string,
): void {
  state.pending.delete(sequence)
  state.delivered = sequence
  if (eventId) rememberSeen(state, eventId)
  sendToRoom(key, message)

  let next = state.delivered + 1
  while (state.pending.has(next)) {
    const queued = state.pending.get(next)!
    state.pending.delete(next)
    state.delivered = next
    if (queued.eventId) rememberSeen(state, queued.eventId)
    sendToRoom(key, queued.message)
    next += 1
  }
}

// Buffer excedido (ou lacuna que não fecha): exige refetch do cliente e alinha o
// progresso local ao watermark, sem encaminhar eventos fora de ordem.
function resyncRoom(key: string, state: ProjectReplayState, reason: ResyncReason): void {
  recordRealtimeResync(reason)
  const room = rooms.get(key)
  if (room) {
    const token = reconciliationToken()
    const message = JSON.stringify(controlMessage(room.projectId, 'RESYNC_REQUIRED', 0, {
      reason,
      watermark: state.sequence,
      token,
      schemaVersion: WS_SCHEMA_VERSION,
    }))
    // Token por conexão: a confirmação de cada cliente é correlacionada.
    for (const client of room.clients) {
      client.data.refetchToken = token
      try { client.send(message) } catch {
        try { client.close() } catch { /* já fechado */ }
        room.clients.delete(client)
      }
    }
  }
  state.pending.clear()
  state.delivered = state.sequence
}

// [T39] Compara o watermark durável de uma sala ativa com o progresso local e
// recupera a última mensagem perdida mesmo sem novo evento publicado.
async function recoverRoom(tenantId: string, projectId: string): Promise<void> {
  const state = stateOf(tenantId, projectId)
  const { persistence } = await import('../persistence/runtime')
  let watermark: number
  try {
    watermark = await persistence.domainEvents.watermark(tenantId, projectId)
  } catch {
    return
  }
  state.sequence = Math.max(state.sequence, watermark)
  if (watermark <= state.delivered) return
  recordRealtimeGap()
  try {
    const [oldest] = await persistence.domainEvents.listAfter({ tenantId, projectId, cursor: state.delivered, limit: 1 })
    if (oldest) recordRealtimeLag((Date.now() - Date.parse(oldest.createdAt)) / 1000)
  } catch {
    // Métrica best-effort; a recuperação abaixo é o que importa.
  }
  await fillGap(tenantId, projectId, state)
}

// [T39] Reconciliação periódica em lote: recompõe assinaturas e compara o
// watermark de todas as salas ativas (heartbeat e reconexão do subscriber).
export async function reconcileActiveRooms(): Promise<void> {
  for (const [, room] of [...rooms]) {
    if (bus && !room.unsubscribe) await subscribeRoom(room)
    await recoverRoom(room.tenantId, room.projectId)
  }
}

// [T39] Busca a lacuna no SQL (verdade durável) quando um evento fora de ordem
// chega: lê a partir do último entregue e entrega contiguamente. Single-flight.
async function fillGap(tenantId: string, projectId: string, state: ProjectReplayState): Promise<void> {
  if (state.filling) return
  state.filling = true
  const key = projectRoomKey(tenantId, projectId)
  try {
    const { persistence } = await import('../persistence/runtime')
    const events = await persistence.domainEvents.listAfter({ tenantId, projectId, cursor: state.delivered, limit: WS_REPLAY_MAX_EVENTS })
    for (const event of events) {
      if (event.sequence <= state.delivered) continue
      const mapped = mapDomainEventToWs(event.type, event.payload)
      if (!mapped) return
      const message = JSON.stringify({ projectId, sequence: event.sequence, type: mapped.type, payload: mapped.payload, eventId: event.id, schemaVersion: event.schemaVersion })
      if (event.sequence === state.delivered + 1) {
        deliverContiguous(key, state, event.sequence, message, event.id)
      } else {
        state.pending.set(event.sequence, { message, eventId: event.id })
      }
    }
  } catch {
    // Mantém pendências; a comparação de watermark (heartbeat) recupera depois.
  } finally {
    state.filling = false
  }
}

// [T38]/[T39] Publica um evento já confirmado na outbox, usando a SEQUÊNCIA
// DURÁVEL alocada no commit. É o único caminho de publicação após o cutover; não
// aloca sequência local. Deduplica por eventId/sequence e só entrega em ordem
// contígua, conservando eventos fora de ordem em buffer limitado.
export function publishDurableEvent<T>(
  tenantId: string,
  projectId: string,
  sequence: number,
  event: WsEventInput<T>,
  identity?: { eventId?: string; schemaVersion?: number },
): void {
  const key = projectRoomKey(tenantId, projectId)
  const state = stateOf(tenantId, projectId)
  state.sequence = Math.max(state.sequence, sequence)

  const eventId = identity?.eventId
  // Duplicata já aplicada (por identidade ou por sequence não avançada).
  if (eventId && state.seen.has(eventId)) {
    recordRealtimeDedup()
    return
  }
  if (sequence <= state.delivered) {
    recordRealtimeDedup()
    return
  }
  if (state.pending.has(sequence)) return

  const ordered: WsEvent<T> = { ...event, projectId, sequence, ...identity }
  const message = JSON.stringify(ordered)

  // [T39] Mudança de membership/grupos revalida a sala imediatamente.
  if (ordered.type === 'PROJECT_METADATA_CHANGED') {
    const section = (ordered.payload as { section?: string } | undefined)?.section
    if (section === 'members' || section === 'squads') revalidateRoomSoon(tenantId, projectId)
  }

  if (sequence === state.delivered + 1) {
    deliverContiguous(key, state, sequence, message, eventId)
    return
  }

  // Lacuna: retém em buffer limitado e tenta fechar pelo SQL.
  recordRealtimeGap()
  state.pending.set(sequence, { message, eventId })
  if (state.pending.size > WS_LIVE_BUFFER_MAX) {
    resyncRoom(key, state, 'overflow')
    return
  }
  void fillGap(tenantId, projectId, state)
}

// Heartbeat do servidor: mantém proxies acordados, descarta peers mortos,
// revalida a autorização das salas ativas e reconcilia watermarks (T39).
export function heartbeatTick(): void {
  for (const [key, room] of [...rooms]) {
    sendToRoom(key, JSON.stringify(controlMessage(room.projectId, 'HEARTBEAT')))
  }
  for (const [key, room] of [...rooms]) void revalidateRoom(key, room)
  void reconcileActiveRooms()
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function startHeartbeat(): void {
  if (heartbeatTimer) return
  heartbeatTimer = setInterval(heartbeatTick, WS_HEARTBEAT_INTERVAL_MS)
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

// Uso em testes: limpa salas, assinaturas e estado de consumo.
export function resetRealtimeState(): void {
  for (const room of rooms.values()) teardownRoom(room)
  rooms.clear()
  replayState.clear()
}
