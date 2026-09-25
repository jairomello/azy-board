import type { WsEvent, WsEventType } from '@azy-board/realtime-contracts'

// Eventos aplicados incrementalmente no cache do board (patch por item).
export const BOARD_INCREMENTAL_EVENT_TYPES: WsEventType[] = [
  'CARD_MOVED',
  'ITEM_CREATED',
  'MODULE_CREATED',
  'ITEM_UPDATED',
  'ITEM_DELETED',
  'CARD_CREATED',
  'CARD_UPDATED',
  'CARD_DELETED',
  'TASK_CLAIMED',
  'SUBTASK_CREATED',
  'CHECKLIST_UPDATED',
]

// Eventos que invalidam (refazem) a consulta do dashboard.
export const DASHBOARD_INVALIDATE_EVENT_TYPES: WsEventType[] = [
  'ITEM_CREATED',
  'ITEM_UPDATED',
  'ITEM_DELETED',
  'SPRINT_CHANGED',
  'PROGRESS_UPDATED',
]

// Monta os handlers do dashboard: cada evento invalida (refaz) a consulta.
export function buildDashboardHandlers(invalidate: () => void): Partial<Record<WsEventType, (event: WsEvent) => void>> {
  const handlers: Partial<Record<WsEventType, (event: WsEvent) => void>> = {}
  for (const type of DASHBOARD_INVALIDATE_EVENT_TYPES) handlers[type] = () => invalidate()
  return handlers
}
