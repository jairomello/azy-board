import type { ProjectMetadataSection, WsEvent, WsEventType } from '@azy-board/realtime-contracts'

// Eventos aplicados incrementalmente no cache do board (patch por item).
export const BOARD_PATCH_EVENT_TYPES: WsEventType[] = [
  'CARD_MOVED',
  'ITEM_CREATED',
  'MODULE_CREATED',
  'ITEM_UPDATED',
  'ITEM_DELETED',
  'CARD_UPDATED',
  'TASK_CLAIMED',
  'SUBTASK_CREATED',
  'CHECKLIST_UPDATED',
]

// Eventos que exigem refetch do board em vez de patch incremental
// (reordenações e metadados: o payload não mapeia 1:1 para o cache do board).
export const BOARD_INVALIDATE_EVENT_TYPES: WsEventType[] = [
  'PROJECT_METADATA_CHANGED',
]

// Eventos que invalidam (refazem) a consulta do dashboard.
export const DASHBOARD_INVALIDATE_EVENT_TYPES: WsEventType[] = [
  'ITEM_CREATED',
  'ITEM_UPDATED',
  'ITEM_DELETED',
  'SPRINT_CHANGED',
  'PROJECT_METADATA_CHANGED',
]

// Seções de metadados que afetam as consultas de Settings.
export const SETTINGS_METADATA_SECTIONS: ProjectMetadataSection[] = [
  'columns', 'modules', 'sprints', 'tags', 'versions', 'members', 'squads', 'costCenters', 'project',
]

// Módulos usam o evento dedicado MODULE_CREATED (patch incremental no board),
// por isso não entram no mapa de metadados de Settings.
export function settingsSectionOf(event: WsEvent): ProjectMetadataSection | null {
  if (event.type !== 'PROJECT_METADATA_CHANGED') return event.type === 'MODULE_CREATED' ? 'modules' : null
  const section = (event.payload as { section?: ProjectMetadataSection }).section
  return section && SETTINGS_METADATA_SECTIONS.includes(section) ? section : null
}

// Monta os handlers do dashboard: cada evento invalida (refaz) a consulta.
export function buildDashboardHandlers(invalidate: () => void): Partial<Record<WsEventType, (event: WsEvent) => void>> {
  const handlers: Partial<Record<WsEventType, (event: WsEvent) => void>> = {}
  for (const type of DASHBOARD_INVALIDATE_EVENT_TYPES) handlers[type] = () => invalidate()
  return handlers
}

// Monta os handlers de Settings: metadados invalidam a consulta da seção afetada.
export function buildSettingsHandlers(invalidateSection: (section: ProjectMetadataSection) => void): Partial<Record<WsEventType, (event: WsEvent) => void>> {
  const handlers: Partial<Record<WsEventType, (event: WsEvent) => void>> = {}
  const handle = (event: WsEvent) => {
    const section = settingsSectionOf(event)
    if (section) invalidateSection(section)
  }
  handlers.PROJECT_METADATA_CHANGED = handle
  handlers.MODULE_CREATED = handle
  return handlers
}
