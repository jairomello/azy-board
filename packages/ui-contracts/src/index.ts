// Contratos de UI: preferências, board adapter, checklists e helpers de apresentação

import type { ItemType, Priority, TaskStatus } from '@azy-board/domain'

// Preferências de UI
export type Theme = 'light' | 'dark'
export type Language = 'pt-BR' | 'en' | 'es'
export type LightShellTheme = 'petroleum' | 'ocean' | 'emerald' | 'graphite' | 'classic'

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
    wip: { total: number; byStatus: Record<string, number>; byStatusPoints: Record<string, number>; pointsCoverage: number | null; items: DashboardItemDetail[] }
    blocked: { total: number; items: DashboardItemDetail[] }
    overdue: { total: number; items: DashboardItemDetail[]; remainingItems: DashboardItemDetail[] }
    teamLoad: { members: Array<{ userId: string; userName: string; squadId: string | null; squadName: string | null; wipTotal: number; blockedSubset?: number; wipPoints: number | null; blockedPoints?: number | null; pointsCoverage: number | null }>; unassignedWip: number; blockedUnassignedSubset?: number; unassignedWipPoints: number | null; unassignedBlockedPoints?: number | null; pointsCoverage: number | null }
  }
}

export interface DashboardBurnupPoint { date: string; total: number; done: number; points: number; donePoints: number }
export interface DashboardBurnup { partial: boolean; coverageStartedAt?: string | null; series: DashboardBurnupPoint[] }
export interface DashboardAging { coverageStartedAt: string | null; items: DashboardItemDetail[] }
export interface DashboardHours { semantics: string; totalMinutes: number; rows: Array<{ authorId: string; authorName: string | null; squadName: string | null; itemId: string; versionId: string | null; moduleId: string | null; durationMin: number | null; createdAt?: string }> }
