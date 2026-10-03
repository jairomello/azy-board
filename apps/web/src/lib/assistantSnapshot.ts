// Fotografia do contexto da tela para o Azy Agent (Card T16).
//
// Deriva a fotografia do MESMO estado que determina o conteúdo apresentado.
// Sem filtro nenhum, o escopo é ALL e nenhuma ID viaja (evita inflar o prompt
// em projetos com milhares de tickets); com filtro, o conjunto do resultado
// viaja em displayedItemIds — limitado, com truncamento declarado.
import type {
  AssistantScreen,
  AssistantScreenFilterValue,
  AssistantScreenSnapshot,
} from '@azy-board/assistant-contracts'

// Espelho do EMPTY_FILTER_VALUE (features/board/model/types) sem importar a
// feature (partição lib → features).
const EMPTY_FILTER_SENTINEL = '__empty__'

// Filtros que recortam a população de cards. Estados de apresentação
// (hideEmptyEpics/hideEmptyStories/density/storyDisplay) NÃO contam como filtro.
const POPULATION_FILTER_KEYS = [
  'moduleId', 'sprintId', 'versionId', 'assigneeId', 'squadId', 'costCenterId',
  'authorId', 'status', 'priority', 'parent', 'titleContains', 'types', 'tagIds',
] as const

// Alinhado ao limite de itemIds do lote (tool-registry/routes de batch).
export const MAX_SNAPSHOT_IDS = 500

export type ScreenFilterInput = Record<string, string | string[] | boolean | null>

export function toFilterValue(value: string | string[] | boolean | null): AssistantScreenFilterValue {
  if (value === '' || value === undefined || value === false) return null
  if (value === true) return 'true'
  if (value === EMPTY_FILTER_SENTINEL) return { operator: 'IS_EMPTY' }
  return value
}

export function hasPopulationFilter(filters: ScreenFilterInput): boolean {
  return POPULATION_FILTER_KEYS.some(key => {
    const value = filters[key]
    if (value === null || value === undefined || value === '') return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'boolean') return false
    return true
  })
}

export interface SnapshotCaptureInput {
  screen: AssistantScreen
  route: string
  projectId: string | null
  projectName: string | null
  viewMode: 'kanban' | 'tree'
  activeModuleId: string | null
  collapsedGroupIds: string[]
  filters: ScreenFilterInput
  // IDs reais de cards de ação (TASK/BUG) representados no resultado.
  actionCardIds: string[]
  // Revisões (updatedAt) dos cards; ausente não bloqueia (verificação por item).
  revisions: Record<string, string>
}

export function buildScreenSnapshot(input: SnapshotCaptureInput): AssistantScreenSnapshot {
  const filtered = hasPopulationFilter(input.filters)
  // ALL: sem lista de IDs — o agente aplica a ação a todos via matchAll server-side.
  const sourceIds = filtered ? input.actionCardIds : []
  const truncated = sourceIds.length > MAX_SNAPSHOT_IDS
  const displayedItemIds = truncated ? sourceIds.slice(0, MAX_SNAPSHOT_IDS) : sourceIds

  const inscopeRevisionIds = new Set(displayedItemIds)
  const revisions: Record<string, string> = {}
  for (const [id, revision] of Object.entries(input.revisions)) {
    if (inscopeRevisionIds.has(id) && revision) revisions[id] = revision
  }

  const filters: Record<string, AssistantScreenFilterValue> = {}
  for (const [key, value] of Object.entries(input.filters)) {
    const converted = toFilterValue(value)
    if (converted !== null) filters[key] = converted
  }

  return {
    schemaVersion: 1,
    contextId: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    route: input.route,
    screen: input.screen,
    projectId: input.projectId,
    projectName: input.projectName,
    view: { mode: input.viewMode, activeModuleId: input.activeModuleId, collapsedGroupIds: input.collapsedGroupIds },
    filters,
    scope: { mode: filtered ? 'FILTERED' : 'ALL' },
    results: {
      displayedItemIds,
      displayedCount: input.actionCardIds.length,
      totalMatchingCount: input.actionCardIds.length,
      isComplete: !truncated,
      revisions,
    },
    focus: { modalStack: 0, activeItemId: null, activeTab: null, hasUnsavedChanges: false },
  }
}
