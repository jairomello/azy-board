// Contratos WebSocket compartilhados

export type WsEventType =
  | 'CARD_MOVED'
  | 'CARD_CREATED'
  | 'CARD_UPDATED'
  | 'CARD_DELETED'
  | 'TASK_CLAIMED'
  | 'SPRINT_CHANGED'
  | 'SUBTASK_CREATED'
  | 'PROGRESS_UPDATED'
  | 'ITEM_CREATED'
  | 'ITEM_UPDATED'
  | 'ITEM_DELETED'
  | 'CHECKLIST_UPDATED'
  | 'MODULE_CREATED'

export interface WsEvent<T = unknown> {
  type: WsEventType
  projectId: string
  payload: T
}
