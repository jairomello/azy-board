// Enums de domínio compartilhados entre API, web e MCP

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED' | 'ARCHIVED'
// Status base de coluna — não inclui ARCHIVED (colunas não podem ter este baseStatus)
export type ColumnBaseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
// Mantido para retrocompatibilidade em código legado — usar ItemType nos novos usos
export type TaskType = 'TASK' | 'BUG' | 'STORY'
export type ItemType = 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'EXTERNAL'
// Tipo de dependência de cronograma (padrão MS Project): Término-Início,
// Início-Início, Início-Término e Término-Término. FS é o default.
export type ItemDependencyType = 'FS' | 'SS' | 'SF' | 'FF'
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

// ---------------------------------------------------------------------------
// Janelas de última alteração (T57) — fonte única entre API, web e MCP.
// Cada opção recorta cards cujo `updatedAt` é >= ao início da janela
// (dias-calendário no fuso do projeto). `current-sprint` não é janela de tempo:
// seleciona cards vinculados à sprint vigente.
// ---------------------------------------------------------------------------
export type UpdatedWithin = '1d' | '2d' | '3d' | '5d' | '1w' | '1m' | 'current-sprint'

export const UPDATED_WITHIN_VALUES: readonly UpdatedWithin[] = ['1d', '2d', '3d', '5d', '1w', '1m', 'current-sprint']

// Dias-calendário para trás de cada janela de tempo (current-sprint não usa dias).
export const UPDATED_WITHIN_DAYS: Record<Exclude<UpdatedWithin, 'current-sprint'>, number> = {
  '1d': 1, '2d': 2, '3d': 3, '5d': 5, '1w': 7, '1m': 30,
}

// Fuso do projeto usado para calcular o início dos dias-calendário.
export const PROJECT_TIME_ZONE = 'America/Sao_Paulo'

export function isUpdatedWithin(value: unknown): value is UpdatedWithin {
  return typeof value === 'string' && (UPDATED_WITHIN_VALUES as readonly string[]).includes(value)
}

type TimeZoneParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function timeZoneParts(date: Date, timeZone: string): TimeZoneParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? '0')
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') }
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = timeZoneParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

// Início da janela em UTC ISO, considerando `days` dias-calendário para trás no
// fuso informado (00:00 local). Função pura para testes determinísticos.
export function updatedWithinStart(window: Exclude<UpdatedWithin, 'current-sprint'>, reference: Date, timeZone = PROJECT_TIME_ZONE): string {
  const days = UPDATED_WITHIN_DAYS[window]
  const parts = timeZoneParts(reference, timeZone)
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day) - days * 86_400_000
  const offset = timeZoneOffsetMs(reference, timeZone)
  return new Date(localMidnightAsUtc - offset).toISOString()
}
