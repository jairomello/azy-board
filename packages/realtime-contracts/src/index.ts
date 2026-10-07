// Contratos WebSocket compartilhados
//
// O canal é de notificação: mutações passam pela API REST e o servidor
// transmite os eventos às salas do projeto. Cada evento de domínio carrega
// uma `sequence` monotônica por projeto, usada pelo cliente como cursor para
// replay na reconexão. Mensagens de controle (heartbeat, replay e
// ressincronização) vivem fora do contrato de domínio.
//
// [T39] O envelope é versionado e carrega identidade durável (`eventId`) e
// `schemaVersion` da outbox T38, permitindo deduplicação e validação entre
// instâncias. Campos novos são aditivos/opcionais para não quebrar clientes e
// servidores legados durante o rollout.

// Tipos de eventos de domínio. Só entram aqui tipos efetivamente emitidos
// pelas rotas da API — sem tipos legados.
export type WsEventType =
  | 'CARD_MOVED'
  | 'CARD_UPDATED'
  | 'TASK_CLAIMED'
  | 'SPRINT_CHANGED'
  | 'SUBTASK_CREATED'
  | 'ITEM_CREATED'
  | 'ITEM_UPDATED'
  | 'ITEM_DELETED'
  | 'CHECKLIST_UPDATED'
  | 'MODULE_CREATED'
  | 'PROJECT_METADATA_CHANGED'

// Fonte única para validação runtime; mantida em sincronia com o tipo acima.
export const WS_EVENT_TYPES: readonly WsEventType[] = [
  'CARD_MOVED',
  'CARD_UPDATED',
  'TASK_CLAIMED',
  'SPRINT_CHANGED',
  'SUBTASK_CREATED',
  'ITEM_CREATED',
  'ITEM_UPDATED',
  'ITEM_DELETED',
  'CHECKLIST_UPDATED',
  'MODULE_CREATED',
  'PROJECT_METADATA_CHANGED',
]

// Seções de metadados do projeto cobertas por PROJECT_METADATA_CHANGED.
export type ProjectMetadataSection =
  | 'columns'
  | 'modules'
  | 'sprints'
  | 'tags'
  | 'versions'
  | 'members'
  | 'squads'
  | 'costCenters'
  | 'project'

export interface WsEvent<T = unknown> {
  type: WsEventType
  projectId: string
  payload: T
  // Ordem monotônica por projeto; é o cursor que o cliente mantém.
  sequence: number
  // [T39] Identidade durável do evento na outbox T38; usada para deduplicar
  // republicações/replays. Ausente em produtores legados.
  eventId?: string
  // [T39] Versão do envelope (`schema_version` da outbox). Ausente em legados.
  schemaVersion?: number
}

// Evento como é produzido pelas rotas: a sequence é alocada pelo broadcast do
// servidor, então os emissores não a informam.
export type WsEventInput<T = unknown> = Omit<WsEvent<T>, 'sequence'>

// Motivo tipado de ressincronização. `legacy` cobre cursor/protocolo anterior
// incompatível com a sequência global; `retention`/`overflow` cobrem histórico
// fora da janela e buffer excedido.
export type ResyncReason = 'cursor-ahead' | 'gap' | 'invalid' | 'retention' | 'overflow' | 'legacy'

export const RESYNC_REASONS: readonly ResyncReason[] = [
  'cursor-ahead',
  'gap',
  'invalid',
  'retention',
  'overflow',
  'legacy',
]

// Mensagens de controle do canal. Nunca são eventos de domínio: não tocam o
// estado de dados, apenas o controle de conexão/sincronização do cliente.
// `REFETCH_COMPLETE` é enviado pelo cliente após concluir as consultas ativas,
// confirmando a barreira de reconciliação ao servidor.
export type WsControlType = 'REPLAY_COMPLETE' | 'RESYNC_REQUIRED' | 'HEARTBEAT' | 'REFETCH_COMPLETE'

export const WS_CONTROL_TYPES: readonly WsControlType[] = [
  'REPLAY_COMPLETE',
  'RESYNC_REQUIRED',
  'HEARTBEAT',
  'REFETCH_COMPLETE',
]

export interface WsControlMessage {
  kind: 'control'
  type: WsControlType
  projectId: string
  // REPLAY_COMPLETE carrega a sequence atual do servidor; os demais usam 0.
  sequence: number
  // [T39] Watermark durável aplicado (REPLAY_COMPLETE) ou exigido
  // (RESYNC_REQUIRED). Ausente em legados.
  watermark?: number
  // [T39] Motivo tipado da ressincronização (RESYNC_REQUIRED).
  reason?: ResyncReason
  // [T39] Token de barreira de refetch; ecoado pelo cliente em
  // REFETCH_COMPLETE para correlacionar a confirmação.
  token?: string
  // [T39] Versão do envelope negociada.
  schemaVersion?: number
}

export type WsServerMessage = WsEvent | WsControlMessage

export function isControlMessage(message: WsServerMessage): message is WsControlMessage {
  return (message as WsControlMessage).kind === 'control'
}

export function isWsEventType(value: unknown): value is WsEventType {
  return typeof value === 'string' && (WS_EVENT_TYPES as readonly string[]).includes(value)
}

export function isWsControlType(value: unknown): value is WsControlType {
  return typeof value === 'string' && (WS_CONTROL_TYPES as readonly string[]).includes(value)
}

export function isResyncReason(value: unknown): value is ResyncReason {
  return typeof value === 'string' && (RESYNC_REASONS as readonly string[]).includes(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

// Validação runtime do envelope recebido: aceita string JSON ou objeto já
// parseado e rejeita payload incoerente em vez de confiar em cast. Campos
// opcionais são validados quando presentes, preservando compatibilidade.
export function parseServerMessage(raw: unknown): WsServerMessage | null {
  let value: unknown = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  const message = value as Record<string, unknown>

  if (message.kind === 'control') {
    if (!isWsControlType(message.type)) return null
    if (typeof message.projectId !== 'string' || !isInteger(message.sequence)) return null
    if (message.watermark !== undefined && !isInteger(message.watermark)) return null
    if (message.reason !== undefined && !isResyncReason(message.reason)) return null
    if (message.token !== undefined && typeof message.token !== 'string') return null
    if (message.schemaVersion !== undefined && !isInteger(message.schemaVersion)) return null
    return message as unknown as WsControlMessage
  }

  if (!isWsEventType(message.type)) return null
  if (typeof message.projectId !== 'string' || !isInteger(message.sequence)) return null
  if (message.eventId !== undefined && typeof message.eventId !== 'string') return null
  if (message.schemaVersion !== undefined && !isInteger(message.schemaVersion)) return null
  return message as unknown as WsEvent
}

export function isServerMessage(raw: unknown): raw is WsServerMessage {
  return parseServerMessage(raw) !== null
}

// Intervalo de heartbeat do servidor e tolerância do cliente a conexão zumbi
// (2× o intervalo sem mensagens trata a conexão como morta).
export const WS_HEARTBEAT_INTERVAL_MS = 20_000
export const WS_ZOMBIE_TIMEOUT_MS = 2 * WS_HEARTBEAT_INTERVAL_MS

// Tamanho do ring buffer por projeto (eventos disponíveis para replay).
export const WS_REPLAY_BUFFER_SIZE = 500

// [T39] Versão do protocolo negociada no handshake: o servidor anuncia a
// versão corrente e aceita clientes que declarem ao menos a mínima suportada.
export const WS_PROTOCOL_VERSION = 2
export const WS_MIN_SUPPORTED_PROTOCOL_VERSION = 1

// [T39] Versão do envelope, alinhada ao `schema_version` da outbox T38.
export const WS_SCHEMA_VERSION = 1

// [T39] Retenção mínima de replay e limite de eventos por reconciliação,
// alinhados à outbox T38 (poda em 24 h; no máximo 1.000 eventos por página).
export const WS_REPLAY_RETENTION_MS = 24 * 60 * 60 * 1000
export const WS_REPLAY_MAX_EVENTS = 1000

// [T39] Buffer live durante replay/refetch (limite de memória; overflow exige
// nova ressincronização) e teto de tentativas de refetch antes de permanecer
// em `syncing`.
export const WS_LIVE_BUFFER_MAX = 1000
export const WS_REFETCH_MAX_ATTEMPTS = 5
