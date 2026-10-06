import type { WsEventType } from '@azy-board/realtime-contracts'

// [T38] Tipos de evento de DOMÍNIO persistidos na outbox. São fatos internos,
// independentes do transporte; o dispatcher mapeia para o contrato WebSocket.
// Payload mínimo (delta factual ou invalidação) — nunca a projeção completa.
export const DOMAIN_EVENT_TYPES = {
  itemCreated: 'item.created',
  itemUpdated: 'item.updated',
  itemDeleted: 'item.deleted',
  projectMetadataChanged: 'project.metadata.changed',
} as const

export type DomainEventType = typeof DOMAIN_EVENT_TYPES[keyof typeof DOMAIN_EVENT_TYPES]

export interface ItemInvalidationPayload {
  itemIds: string[]
  parentId?: string | null
}

export interface MetadataInvalidationPayload {
  section: string
}

/** Tipos que já são o contrato WebSocket e trafegam por identidade (delta factual). */
const IDENTITY_WS_TYPES: ReadonlySet<string> = new Set<WsEventType>([
  'CARD_MOVED', 'CARD_UPDATED', 'TASK_CLAIMED', 'SPRINT_CHANGED', 'SUBTASK_CREATED',
  'ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED', 'CHECKLIST_UPDATED', 'MODULE_CREATED',
  'PROJECT_METADATA_CHANGED',
])

/** Traduz o evento de domínio para o contrato de tempo real (invalidação/delta). */
export function mapDomainEventToWs(type: string, payload: unknown): { type: WsEventType; payload: unknown } | null {
  if (type === DOMAIN_EVENT_TYPES.itemCreated) {
    const data = payload as ItemInvalidationPayload
    return { type: data.parentId ? 'SUBTASK_CREATED' : 'ITEM_CREATED', payload: { itemIds: data.itemIds, parentId: data.parentId ?? null } }
  }
  if (type === DOMAIN_EVENT_TYPES.itemUpdated) {
    const data = payload as ItemInvalidationPayload
    return { type: 'ITEM_UPDATED', payload: { itemIds: data.itemIds } }
  }
  if (type === DOMAIN_EVENT_TYPES.itemDeleted) {
    const data = payload as ItemInvalidationPayload
    return { type: 'ITEM_DELETED', payload: { itemIds: data.itemIds } }
  }
  if (type === DOMAIN_EVENT_TYPES.projectMetadataChanged) {
    const data = payload as MetadataInvalidationPayload
    return { type: 'PROJECT_METADATA_CHANGED', payload: { section: data.section } }
  }
  if (IDENTITY_WS_TYPES.has(type)) return { type: type as WsEventType, payload }
  return null
}
