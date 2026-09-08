// Enums de domínio compartilhados entre API, web e MCP

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED' | 'ARCHIVED'
// Status base de coluna — não inclui ARCHIVED (colunas não podem ter este baseStatus)
export type ColumnBaseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
// Mantido para retrocompatibilidade em código legado — usar ItemType nos novos usos
export type TaskType = 'TASK' | 'BUG' | 'STORY'
export type ItemType = 'EPIC' | 'STORY' | 'TASK' | 'BUG'
export type MemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER'
export type GlobalGroup = 'TEAM_MEMBER' | 'MANAGER' | 'ADMIN' | 'ROOT'
export type BoardMode = 'HIERARCHICAL' | 'SIMPLE'
export type SprintStatus = 'PROPOSED' | 'OPEN' | 'CLOSED'
export interface Sprint {
  id: string
  name: string
  status: SprintStatus
  startDate: string
  endDate: string
}
export type NodeType = 'module' | 'EPIC' | 'STORY' | 'TASK' | 'BUG'
// Visibilidade do projeto na listagem
// isRestricted: só aparece para quem tem vínculo (membro da equipe ou gerente), inclusive ADMIN/ROOT
// isHidden: sai das listagens por padrão e só volta quando a consulta informa includeHidden=true
export interface ProjectVisibility {
  isRestricted: boolean
  isHidden: boolean
}
export type Theme = 'light' | 'dark'
export type Language = 'pt-BR' | 'en' | 'es'
export type ActivityActorType = 'HUMAN' | 'AGENT' | 'SYSTEM' | 'UNKNOWN'
export type ActivitySource = 'REST' | 'MCP' | 'SYSTEM' | 'UNKNOWN'

export interface WorkLog {
  id: string
  itemId: string
  authorId: string | null
  author?: { id: string; name: string; avatarUrl: string | null } | null
  activity: string
  durationMin: number | null
  createdAt: string
  updatedAt: string
}

export function parseWorkDuration(value: string): number | null {
  const match = value.trim().match(/^(\d+):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[2])
  if (minutes > 59) return null
  return Number(match[1]) * 60 + minutes
}

export function formatWorkDuration(durationMin: number): string {
  const hours = Math.floor(durationMin / 60)
  const minutes = durationMin % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}
export type LightShellTheme = 'petroleum' | 'ocean' | 'emerald' | 'graphite' | 'classic'

export interface UserPreferences {
  theme: Theme
  lightShellTheme: LightShellTheme
  language: Language
}

export interface AncestorNode {
  id: string
  title: string
  type: string
}

// Referência a um ancestral no breadcrumb
export type AncestorRef = AncestorNode

export interface Tag {
  id: string
  name: string
  color: string
}

// Interface Card — contrato Adapter que qualquer item satisfaz para ser renderizado no board
export interface Card {
  id: string
  type: ItemType
  title: string
  columnId: string | null
  priority: Priority
  status: TaskStatus
  points: number | null
  assigneeId: string | null
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  assigneeApiKey?: { aiModelName: string | null } | null
  tags: Tag[]
  isLeaf: boolean
  childrenCount: number
  ancestryPath: AncestorRef[]
  parentId: string | null
  moduleId: string | null
}

// Converte item raw da API para interface Card
export function toCard(item: {
  id: string
  type: ItemType
  title: string
  columnId?: string | null
  priority: Priority
  status: TaskStatus
  points?: number | null
  assigneeId?: string | null
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  assigneeApiKey?: { aiModelName: string | null } | null
  itemTags?: Array<{ tag: Tag }>
  isLeaf?: boolean
  childrenCount?: number
  ancestryPath: string
  parentId?: string | null
  moduleId?: string | null
}): Card {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    columnId: item.columnId ?? null,
    priority: item.priority,
    status: item.status,
    points: item.points ?? null,
    assigneeId: item.assigneeId ?? null,
    assignee: item.assignee ?? null,
    assigneeApiKey: item.assigneeApiKey ?? null,
    tags: (item.itemTags ?? []).map(it => it.tag),
    isLeaf: item.isLeaf ?? true,
    childrenCount: item.childrenCount ?? 0,
    ancestryPath: (() => {
      try { return JSON.parse(item.ancestryPath || '[]') } catch { return [] }
    })(),
    parentId: item.parentId ?? null,
    moduleId: item.moduleId ?? null,
  }
}

// Checklist e seus itens — anotações de progresso dentro de qualquer card
export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
  position: number
}

export interface Checklist {
  id: string
  name: string
  position: number
  items: ChecklistItem[]
}

export interface ChecklistProgress {
  checked: number
  total: number
}

// Payload do JWT — inclui tenant_id para isolamento multi-tenant
export interface JwtPayload {
  sub: string       // userId
  tenantId: string  // [TENANT] sempre presente no token
  email: string
  role: 'user'
  globalGroup?: GlobalGroup
  iat: number
  exp: number
}

// Contexto injetado pelo middleware em cada requisição
export interface RequestContext {
  userId: string
  tenantId: string  // [TENANT] resolvido do JWT ou API Key
  email: string
  globalGroup: GlobalGroup
}

// Contratos persistidos do Azy Agent. Segredos nunca fazem parte destes tipos.
export type AssistantProvider = 'OPENAI'
export type AssistantCredentialMode = 'API_KEY'
export type AssistantValidationStatus = 'UNVALIDATED' | 'VALID' | 'INVALID'
export type AssistantAvailabilityStatus = 'DISABLED' | 'PENDING_CONFIGURATION' | 'AVAILABLE'
export type AssistantConversationRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
export type AssistantRunStatus = 'QUEUED' | 'RUNNING' | 'WAITING_USER' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
export type AssistantEventType = 'RUN_CREATED' | 'RUN_STARTED' | 'TEXT_DELTA' | 'TOOL_STARTED' | 'TOOL_COMPLETED' | 'QUESTION' | 'APPROVAL_REQUIRED' | 'APPROVAL_DECIDED' | 'RUN_FAILED' | 'RUN_CANCELLED' | 'RUN_COMPLETED'
export type AssistantToolCallStatus = 'PENDING' | 'WAITING_APPROVAL' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'CANCELLED'
export type AssistantRiskLevel = 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE'
export type AssistantApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

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

// Evento WebSocket tipado
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

// Contratos compartilhados do Dashboard por projeto. Os campos de detalhe são
// deliberadamente pequenos: a tela pode abrir o item no Board sem duplicar a
// descrição ou outros dados de domínio.
export type DashboardFilterKey = 'from' | 'to' | 'moduleId' | 'sprintId' | 'versionId' | 'squadId' | 'assigneeId' | 'type'
export type DashboardBoxKey = 'progressScope' | 'wip' | 'blocked' | 'overdue' | 'burnup' | 'aging' | 'teamLoad' | 'hours'
export type DashboardState = 'ready' | 'loading' | 'empty' | 'error' | 'partial' | 'inapplicable'

export interface DashboardFilters {
  from: string
  to: string
  moduleId: string
  sprintId: string
  versionId: string
  squadId: string
  assigneeId: string
  type: '' | 'TASK' | 'BUG'
}

export interface DashboardFilterInfo {
  applied: DashboardFilterKey[]
  inapplicable: DashboardFilterKey[]
}

export interface DashboardCoverage {
  startedAt: string | null
  partial: boolean
}

export interface DashboardItemDetail {
  id: string
  title: string
  type?: ItemType
  status?: TaskStatus
  assigneeId?: string | null
  blockedReason?: string | null
  assigneeName?: string | null
  points?: number | null
  dueDate?: string | null
  startedAt?: string
  ageHours?: number
  blockedAgeDays?: number | null
  minimumKnown?: boolean
}

export interface DashboardSnapshot {
  coverage: DashboardCoverage
  filters: DashboardFilterInfo
  boxes: {
    progressScope: { total: number; done: number; completionPercent: number | null; points: number; donePoints: number; estimationCoverage: number | null }
    wip: { total: number; byStatus: Record<string, number>; byStatusPoints: Record<string, number>; pointsCoverage: number | null; items: DashboardItemDetail[] }
    blocked: { total: number; items: DashboardItemDetail[] }
    overdue: { total: number; items: DashboardItemDetail[]; remainingItems: DashboardItemDetail[] }
    teamLoad: { members: Array<{ userId: string; userName: string; squadId: string | null; squadName: string | null; wipTotal: number; wipPoints: number | null; pointsCoverage: number | null }>; unassignedWip: number; unassignedWipPoints: number | null; pointsCoverage: number | null }
  }
}

export interface DashboardBurnupPoint { date: string; total: number; done: number; points: number; donePoints: number }
export interface DashboardBurnup { partial: boolean; coverageStartedAt?: string | null; series: DashboardBurnupPoint[] }
export interface DashboardAging { coverageStartedAt: string | null; items: DashboardItemDetail[] }
export interface DashboardHours { semantics: string; totalMinutes: number; rows: Array<{ authorId: string; authorName: string | null; squadName: string | null; itemId: string; versionId: string | null; moduleId: string | null; durationMin: number | null; createdAt?: string }> }
