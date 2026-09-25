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

export interface Column {
  id: string
  name: string
  baseStatus: ColumnBaseStatus
  position: number
}
export type NodeType = 'module' | 'EPIC' | 'STORY' | 'TASK' | 'BUG'
// Visibilidade do projeto na listagem
// isRestricted: só aparece para quem tem vínculo (membro da equipe ou gerente), inclusive ADMIN/ROOT
// isHidden: sai das listagens por padrão e só volta quando a consulta informa includeHidden=true
export interface ProjectVisibility {
  isRestricted: boolean
  isHidden: boolean
}
export type ActivityActorType = 'HUMAN' | 'AGENT' | 'SYSTEM' | 'UNKNOWN'
export type ActivitySource = 'REST' | 'MCP' | 'SYSTEM' | 'UNKNOWN'
