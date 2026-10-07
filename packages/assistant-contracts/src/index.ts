// Contratos persistidos do Azy Agent. Segredos nunca fazem parte destes tipos.

export type AssistantProvider = 'OPENAI' | 'OPENROUTER'
export type AssistantCredentialMode = 'API_KEY'
export type AssistantValidationStatus = 'UNVALIDATED' | 'VALID' | 'INVALID'
export type AssistantAvailabilityStatus = 'DISABLED' | 'PENDING_CONFIGURATION' | 'AVAILABLE'
export type AssistantConversationRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
export type AssistantRunStatus = 'QUEUED' | 'RUNNING' | 'WAITING_USER' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
export type AssistantEventType = 'RUN_CREATED' | 'RUN_STARTED' | 'TEXT_DELTA' | 'TOOL_STARTED' | 'TOOL_COMPLETED' | 'QUESTION' | 'APPROVAL_REQUIRED' | 'APPROVAL_DECIDED' | 'RUN_FAILED' | 'RUN_CANCELLED' | 'RUN_COMPLETED'
export type AssistantToolCallStatus = 'PENDING' | 'WAITING_APPROVAL' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'CANCELLED'
export type AssistantRiskLevel = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE'
export type AssistantApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

export type AssistantScreen = 'projects-index' | 'project-board-kanban' | 'project-board-tree' | 'project-dashboard' | 'project-settings' | 'item-detail' | 'account' | 'admin-users' | 'admin-assistant' | 'global-other'

// Versão do envelope de fotografia do contexto da tela (Card T16).
export const SCREEN_SNAPSHOT_SCHEMA_VERSION = 1

// Espelho fiel dos filtros publicados pela tela. O sentinela da interface
// (`__empty__`) NUNCA viaja como valor: é convertido no operador tipado IS_EMPTY.
export type AssistantScreenFilterValue = string | string[] | boolean | null | { operator: 'IS_EMPTY' }

export type AssistantScreenScopeMode = 'ALL' | 'FILTERED'

// Card T18 — estado de apresentação publicado pela tela, necessário para
// explicar regras da visão (não conta como filtro de população).
export interface AssistantScreenPresentation {
  showSubtasks: boolean
  storyDisplay: 'lanes' | 'cards'
  moduleViewMode: 'hierarchy' | 'tabs'
  hideEmptyEpics: boolean
  hideEmptyStories: boolean
}

// Card T20 — filtros de população e período vigentes na tela do Dashboard.
// Opcional: a ausência degrada a consulta para os filtros explícitos do pedido.
export interface AssistantDashboardContext {
  filters: Record<string, AssistantScreenFilterValue>
  period: { from: string | null; to: string | null }
}

// Card T19 — foco da interface (pilha de modais, item em primeiro plano, aba
// ativa e objeto interno selecionado). IDs são referências a validar.
export type AssistantItemArea = 'details' | 'subtasks' | 'checklists' | 'links' | 'attachments' | 'activity'

export interface AssistantFocusLevel {
  itemId: string
  type: 'EPIC' | 'STORY' | 'TASK' | 'BUG'
}

export type AssistantFocusEntityKind = 'checklist' | 'checklist_item' | 'link' | 'work_log' | 'attachment'

export interface AssistantFocusEntity {
  kind: AssistantFocusEntityKind
  id: string
  parentId?: string | null
}

// Fotografia do contexto da tela capturada no envio do pedido e fixada na
// execução/aprovação. IDs são referências a validar; nunca permissões.
export interface AssistantScreenSnapshot {
  schemaVersion: typeof SCREEN_SNAPSHOT_SCHEMA_VERSION
  // Identificador opaco do envio (dedup/trace); não é chave de tabela.
  contextId: string
  capturedAt: string
  route: string
  screen: AssistantScreen
  projectId: string | null
  projectName: string | null
  view: {
    mode: 'kanban' | 'tree'
    activeModuleId: string | null
    collapsedGroupIds: string[]
    // Card T18 — estado de apresentação para explicar regras da visão. Opcional:
    // a ausência degrada a explicação, sem erro.
    presentation?: AssistantScreenPresentation
  }
  filters: Record<string, AssistantScreenFilterValue>
  // Card T20 — contexto do Dashboard (filtros de população + período). Opcional
  // e restrito à tela project-dashboard; não afeta o escopo de mutação do board.
  dashboard?: AssistantDashboardContext
  // ALL = nenhum filtro aplicado (sem lista de IDs; ação vale para todos).
  // FILTERED = há filtro ativo; o conjunto do resultado viaja em results.
  scope: { mode: AssistantScreenScopeMode }
  results: {
    // Presente e preenchido apenas quando scope = FILTERED.
    displayedItemIds: string[]
    displayedCount: number
    // Contagem total da consulta; null quando desconhecida (servidor resolve).
    totalMatchingCount: number | null
    isComplete: boolean
    // Revisão (updatedAt) de cada card capturado — detecção de concorrência.
    revisions: Record<string, string>
  }
  focus: {
    modalStack: number
    // Card T19 — pilha ordenada de modais (raiz→topo). `activeItemId` é o item
    // em primeiro plano (topo da pilha) e `activeTab` é a área ativa do item.
    modalPath?: AssistantFocusLevel[]
    activeItemId: string | null
    activeTab: AssistantItemArea | null
    // Objeto interno selecionado (checklist/etapa, link, apontamento, anexo).
    activeEntity?: AssistantFocusEntity | null
    hasUnsavedChanges: boolean
  }
}

export interface AssistantAvailability {
  enabled: boolean
  configured: boolean
  provider: AssistantProvider | null
  status: AssistantAvailabilityStatus
}

export interface AssistantProviderConfiguration {
  provider: AssistantProvider
  model: string
  credentialMode: AssistantCredentialMode
  validationStatus: AssistantValidationStatus
  validatedAt: string | null
}

export interface AssistantCredentialMetadata {
  id: string
  provider: AssistantProvider
  credentialMode: AssistantCredentialMode
  keyPrefix: string | null
  scopes: string[]
  expiresAt: string | null
  revokedAt: string | null
}

export interface AssistantConversation {
  id: string
  tenantId: string
  userId: string
  projectId: string | null
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface AssistantMessage {
  id: string
  conversationId: string
  role: AssistantConversationRole
  content: string
  createdAt: string
}

export interface AssistantRun {
  id: string
  conversationId: string
  status: AssistantRunStatus
  model: string | null
  currentCursor: number
  idempotencyKey: string | null
  createdAt: string
  expiresAt: string | null
}

export interface AssistantEvent {
  id: string
  runId: string
  sequence: number
  type: AssistantEventType
  payload: Record<string, unknown>
  createdAt: string
}

export interface AssistantToolCall {
  id: string
  runId: string
  toolName: string
  riskLevel: AssistantRiskLevel
  status: AssistantToolCallStatus
  operationHash: string | null
}

export interface AssistantPreview {
  operationHash: string
  summary: string
  scope: string
  count: number
  diff: Record<string, unknown> | null
  expiresAt: string
}

export interface AssistantApproval {
  id: string
  runId: string
  toolCallId: string | null
  status: AssistantApprovalStatus
  preview: AssistantPreview
  decidedBy: string | null
  decidedAt: string | null
}

export * from './assistantLimits'

// Card B7 — digest de descoberta em um passo (recorte exibido ou projeto).
// Somente dados: IDs/numeração, números e resumo de filtro; nunca instruções.
export type ScreenOverviewTarget = 'SCREEN' | 'PROJECT'

export interface ScreenOverviewColumn {
  id: string | null
  name: string
  total: number
  TASK: number
  BUG: number
  // Amostra opcional das primeiras referências (`sequenceCode|title`).
  refs?: string[]
}

export interface ScreenOverview {
  // Presença de contextId/capturedAt indica digest derivado do snapshot.
  contextId: string | null
  capturedAt: string | null
  target: ScreenOverviewTarget
  scopeMode: AssistantScreenScopeMode
  displayedCount: number
  totalMatchingCount: number | null
  filters: Record<string, AssistantScreenFilterValue>
  columns: ScreenOverviewColumn[]
}

// Card T17 — comando de interface emitido pela conversa e aplicado pela aba que
// iniciou o pedido. Filtros e IDs são referências a validar; nunca permissões.
export const VIEW_COMMAND_SCHEMA_VERSION = 1

export type AssistantViewCommandType = 'set_filters' | 'clear_filters' | 'set_view' | 'open_item' | 'reveal_item' | 'open_planning_result' | 'restore_previous_view'

export interface AssistantViewCommand {
  schemaVersion: typeof VIEW_COMMAND_SCHEMA_VERSION
  // Identificador opaco do comando (dedup de reconexão/replay).
  commandId: string
  type: AssistantViewCommandType
  // Presente em set_filters: filtros normalizados (ausência = operador IS_EMPTY).
  filters?: Record<string, AssistantScreenFilterValue>
  // Presente em set_view.
  view?: { mode: 'kanban' | 'tree'; activeModuleId: string | null }
  // Presente em open_item e reveal_item.
  itemId?: string
  // Presente em reveal_item: plano de neutralização dos motivos de visibilidade.
  reveal?: AssistantViewRevealPlan
  // Presente em open_planning_result: população exata do resultado capturado.
  planningResult?: AssistantPlanningResult
}

// Card T26 — recorte fixado aberto no board. A população vem do snapshot do
// servidor e não é reconvertida para os filtros do toolbar (OR continua OR).
export interface AssistantPlanningResult {
  resultId: string
  // IDs exibíveis no Kanban (folhas visíveis no board).
  itemIds: string[]
  // Ancestrais mantidos apenas para navegação na árvore, fora da população.
  ancestorIds: string[]
  // Itens do resultado não apresentáveis no Kanban (ex.: tipos não suportados).
  hiddenCount: number
  totalDistinct: number
  capturedAt: string
  // Chave estável de rótulo (ex.: planning-gap-query, planning-gap:dueDate);
  // o cliente traduz para PT-BR/EN/ES.
  labelKey: string
  // Grupo por lacuna (opcional) quando a abertura é de um grupo específico.
  group?: 'dueDate' | 'points' | 'sprint' | 'version' | 'assignee' | null
}

// Card T18 — plano de revelação de um item escondido. O cliente aplica sobre o
// estado vivo da aba, registra checkpoint e abre o item.
export interface AssistantViewRevealPlan {
  itemId: string
  // Campos de filtro/população a voltar ao estado neutro.
  clearFilterFields?: string[]
  // Campos de apresentação/filtro a definir (ex.: hideEmptyEpics = false).
  setFilterFields?: Record<string, string | boolean | string[]>
  // Aba de módulo a ativar (motivo MODULE_TAB).
  activeModuleId?: string | null
  // Grupos a expandir (motivo COLLAPSED_GROUP).
  expandGroupIds?: string[]
}
