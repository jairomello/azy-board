import type { BoardMode, Column, Sprint } from '@azy-board/domain'

export type { Column, Sprint }
export interface Member { userId: string; name: string; email: string; role: string; squadId?: string | null; squadName?: string | null; avatarUrl?: string | null }
// Usuário do tenant como candidato a membro; `isMember` sinaliza quem já tem
// membership ativa no projeto (a grade pede `eligibleOnly` e não recebe esses).
export interface MemberCandidate { id: string; name: string; email: string; avatarUrl?: string | null; globalGroup: string; isMember: boolean }
// change member-batch-add-grid — envelope paginado de `GET /projects/:id/member-candidates`,
// no mesmo formato de `GET /projects/:id/items`.
export interface MemberCandidatePage {
  data: MemberCandidate[]
  page: number
  limit: number
  total: number
  hasMore: boolean
  nextCursor: string | null
}
// Motivo por entrada devolvido pela adição em lote.
export type MemberBatchReason = 'ALREADY_MEMBER' | 'USER_NOT_IN_TENANT' | 'SQUAD_NOT_IN_PROJECT'
export interface MemberBatchEntry { userId: string; role: string; squadId: string | null }
// change member-batch-add-grid — resultado de `POST /projects/:id/members/batch`.
export interface MemberBatchResult {
  ok: boolean
  created: string[]
  skipped: Array<{ userId: string; reason: MemberBatchReason }>
  invalid: Array<{ userId: string; reason: MemberBatchReason }>
}
// Estado de uma linha da grade: marcação + papel/squad escolhidos naquela linha.
export interface MemberRowSelection { selected: boolean; role: string; squadId: string }
export type MemberSelectionMap = Record<string, MemberRowSelection>
export interface Squad { id: string; name: string; memberCount: number }
export interface Module { id: string; name: string; position: number }
export interface CostCenter { id: string; code: string; description?: string | null; sortOrder: number }
export interface Manager { id: string; name: string; email: string; avatarUrl?: string | null }
export interface ProjectVersion {
  id: string
  name: string
  releaseDate: string | null
  description: string | null
  status: 'PLANNED' | 'IN_DEV' | 'RELEASED' | 'CANCELLED'
  position: number
}

export interface ProjectSettingsData {
  projectName: string
  manager: Manager | null
  managerUserId: string
  boardMode: BoardMode
  isRestricted: boolean
  isHidden: boolean
  advancedChecklists: boolean
  hideModules: boolean
  hideEpics: boolean
  startDate: string
  plannedEndDate: string
  plannedPoints: string
  plannedHours: string
  scope: string
  icon: string | null
  color: string | null
}

// Resposta do servidor para os dados do projeto na seção `project` de Settings.
export interface SettingsProject {
  name: string
  manager?: Manager | null
  boardMode?: BoardMode
  isRestricted?: boolean
  isHidden?: boolean
  advancedChecklists?: boolean
  hideModules?: boolean
  hideEpics?: boolean
  startDate?: string | null
  plannedEndDate?: string | null
  plannedPoints?: number | null
  plannedHours?: number | null
  scope?: string | null
  icon?: string | null
  color?: string | null
}
