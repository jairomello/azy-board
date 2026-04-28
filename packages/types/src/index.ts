// Enums de domínio compartilhados entre API, web e MCP

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
// Mantido para retrocompatibilidade em código legado — usar ItemType nos novos usos
export type TaskType = 'TASK' | 'BUG' | 'STORY'
export type ItemType = 'EPIC' | 'STORY' | 'TASK' | 'BUG'
export type MemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER'
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'DONE'
export type NodeType = 'module' | 'EPIC' | 'STORY' | 'TASK' | 'BUG'
export type Theme = 'light' | 'dark'
export type Language = 'pt-BR' | 'en' | 'es'

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
  iat: number
  exp: number
}

// Contexto injetado pelo middleware em cada requisição
export interface RequestContext {
  userId: string
  tenantId: string  // [TENANT] resolvido do JWT ou API Key
  email: string
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

export interface WsEvent<T = unknown> {
  type: WsEventType
  projectId: string
  payload: T
}
