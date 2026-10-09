// Contratos de UI: preferências, board adapter, checklists e helpers de apresentação

import type { ItemDependencyType, ItemType, Priority, TaskStatus } from '@azy-board/domain'

// Catálogo de ícones do produto — fonte única dos nomes válidos (kebab-case),
// servido por lucide-react (ISC). Compartilhado por web, API e MCP; o mapa de
// nomes para componentes React vive apenas no web (apps/web/src/lib/iconCatalog.ts).
export const ICON_CATALOG = [
  'folder',
  'folder-kanban',
  'layout-dashboard',
  'rocket',
  'target',
  'flag',
  'star',
  'bookmark',
  'heart',
  'zap',
  'flame',
  'lightbulb',
  'bug',
  'wrench',
  'hammer',
  'settings',
  'shield',
  'lock',
  'key',
  'globe',
  'map',
  'compass',
  'palette',
  'brush',
  'pen-tool',
  'code',
  'terminal',
  'database',
  'server',
  'cloud',
  'cpu',
  'smartphone',
  'monitor',
  'camera',
  'image',
  'film',
  'music',
  'gamepad-2',
  'trophy',
  'medal',
  'award',
  'gift',
  'shopping-cart',
  'credit-card',
  'wallet',
  'briefcase',
  'building-2',
  'home',
  'users',
  'user',
  'calendar',
  'clock',
  'bell',
  'mail',
  'message-square',
  'file-text',
  'clipboard-list',
  'book-open',
  'graduation-cap',
  'activity',
] as const

export type IconName = (typeof ICON_CATALOG)[number]

export const DEFAULT_PROJECT_ICON: IconName = 'folder-kanban'
export const DEFAULT_ITEM_ICON: IconName = 'file-text'

// Paleta de cores de ícone — mesma base usada pelas tags (consistência visual).
export const ICON_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
] as const

export type IconColor = (typeof ICON_COLORS)[number]

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && (ICON_CATALOG as readonly string[]).includes(value)
}

export function isIconColor(value: unknown): value is IconColor {
  return typeof value === 'string' && (ICON_COLORS as readonly string[]).includes(value)
}

// Preferências de UI
export type Theme = 'light' | 'dark'
export type Language = 'pt-BR' | 'en' | 'es'

// Fonte única dos presets de shell claro — consumida por web, API e validação.
// A ordem define a ordem de exibição na grade de Aparência.
export const LIGHT_SHELL_THEMES = [
  'petroleum',
  'ocean',
  'emerald',
  'graphite',
  'classic',
  'ruby',
  'amber',
  'amethyst',
  'rose',
  'silver',
] as const
export type LightShellTheme = (typeof LIGHT_SHELL_THEMES)[number]
export const DEFAULT_LIGHT_SHELL_THEME: LightShellTheme = 'petroleum'

export function isLightShellTheme(value: unknown): value is LightShellTheme {
  return typeof value === 'string' && (LIGHT_SHELL_THEMES as readonly string[]).includes(value)
}

export interface UserPreferences {
  theme: Theme
  lightShellTheme: LightShellTheme
  language: Language
  autoThemeByTime: boolean
}

// Board adapter
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
  sequenceCode: string | null
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
  icon: IconName | null
  color: IconColor | null
}

// Converte item raw da API para interface Card
export function toCard(item: {
  id: string
  type: ItemType
  title: string
  sequenceCode?: string | null
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
  icon?: string | null
  color?: string | null
}): Card {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    sequenceCode: item.sequenceCode ?? null,
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
    icon: isIconName(item.icon) ? item.icon : null,
    color: isIconColor(item.color) ? item.color : null,
  }
}

// Checklist e seus itens
export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
  position: number
  dueDate?: string | null
  assigneeId?: string | null
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  description?: string | null
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

// Anexos de card e configuração de storage por tenant
export interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
  url: string
  isImage: boolean
  // T10: metadados humanos opcionais (opcionais no tipo para compatibilidade
  // com respostas antigas; a API atual sempre os retorna).
  originalName?: string
  label?: string | null
  referenceDate?: string | null
  description?: string | null
}

export interface ItemLink {
  id: string
  name: string
  url: string
  description: string | null
  createdAt: string
  updatedAt: string
}

/** Resumo do item dependido para exibição em card e árvore. */
export interface ItemDependencyTarget {
  id: string
  title: string
  type: ItemType
  sequenceCode: string | null
}

export interface ItemDependency {
  id: string
  itemId: string
  dependsOnItemId: string
  dependencyType: ItemDependencyType
  lagDays: number
  createdAt: string
  updatedAt: string
  /** Resumo do item dependido; preenchido nas leituras da API. */
  dependsOn: ItemDependencyTarget
}

export type AttachmentProvider = 'local' | 's3'

export interface TenantAttachmentSettings {
  enabled: boolean
  provider: AttachmentProvider
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKeyId: string
  hasSecret: boolean
}

// Helpers de apresentação
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

// Contratos compartilhados do Dashboard por projeto
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
    wip: { total: number; byStatus: Record<string, number>; byStatusPoints: Record<string, number>; pointsCoverage: number | null; items: DashboardItemDetail[]; pagination?: DashboardPagination }
    blocked: { total: number; items: DashboardItemDetail[]; pagination?: DashboardPagination }
    overdue: { total: number; points?: number; items: DashboardItemDetail[]; remainingItems: DashboardItemDetail[]; pagination?: DashboardPagination; remainingPagination?: DashboardPagination }
    teamLoad: { members: Array<{ userId: string; userName: string; squadId: string | null; squadName: string | null; wipTotal: number; blockedSubset?: number; wipPoints: number | null; blockedPoints?: number | null; pointsCoverage: number | null }>; unassignedWip: number; blockedUnassignedSubset?: number; unassignedWipPoints: number | null; unassignedBlockedPoints?: number | null; pointsCoverage: number | null }
  }
}

export interface DashboardBurnupPoint { date: string; total: number; done: number; points: number; donePoints: number }
export interface DashboardBurnup { partial: boolean; coverageStartedAt?: string | null; projection?: { status: 'ROLLUP' | 'READY' | 'FALLBACK'; version?: number | null; sourceStatus?: string }; warnings?: string[]; series: DashboardBurnupPoint[] }
export interface DashboardAging { coverageStartedAt: string | null; total?: number; pagination?: DashboardPagination; items: DashboardItemDetail[] }
export interface DashboardPagination { limit: number; total: number; hasMore: boolean; truncated: boolean; nextCursor: string | null }
export interface DashboardHours {
  semantics: string
  totalMinutes: number
  totalRows?: number
  byAuthor?: Array<{ authorId: string | null; authorName: string | null; squadName: string | null; totalMinutes: number }>
  pagination?: DashboardPagination
  rows: Array<{ id?: string; authorId: string | null; authorName: string | null; squadName: string | null; itemId: string; versionId: string | null; moduleId: string | null; durationMin: number | null; createdAt?: string }>
}

// Card T18 — avaliador compartilhado de visibilidade (interface + agente).
export * from './visibility'
