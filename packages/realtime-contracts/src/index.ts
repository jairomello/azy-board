// Contratos WebSocket compartilhados
//
// O canal é de notificação: mutações passam pela API REST e o servidor
// transmite os eventos às salas do projeto. Cada evento de domínio carrega
// uma `sequence` monotônica por projeto, usada pelo cliente como cursor para
// replay na reconexão. Mensagens de controle (heartbeat, replay e
// ressincronização) vivem fora do contrato de domínio.

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
}

// Evento como é produzido pelas rotas: a sequence é alocada pelo broadcast do
// servidor, então os emissores não a informam.
export type WsEventInput<T = unknown> = Omit<WsEvent<T>, 'sequence'>

// Mensagens de controle do canal. Nunca são eventos de domínio: não tocam o
// estado de dados, apenas o controle de conexão/sincronização do cliente.
export type WsControlType = 'REPLAY_COMPLETE' | 'RESYNC_REQUIRED' | 'HEARTBEAT'

export interface WsControlMessage {
  kind: 'control'
  type: WsControlType
  projectId: string
  // REPLAY_COMPLETE carrega a sequence atual do servidor; os demais usam 0.
  sequence: number
}

export type WsServerMessage = WsEvent | WsControlMessage

export function isControlMessage(message: WsServerMessage): message is WsControlMessage {
  return (message as WsControlMessage).kind === 'control'
}

// Intervalo de heartbeat do servidor e tolerância do cliente a conexão zumbi
// (2× o intervalo sem mensagens trata a conexão como morta).
export const WS_HEARTBEAT_INTERVAL_MS = 20_000
export const WS_ZOMBIE_TIMEOUT_MS = 2 * WS_HEARTBEAT_INTERVAL_MS

// Tamanho do ring buffer por projeto (eventos disponíveis para replay).
export const WS_REPLAY_BUFFER_SIZE = 500
