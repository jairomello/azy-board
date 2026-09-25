import type { BoardMode, Column, Sprint } from '@azy-board/domain'

export type { Column, Sprint }
export interface Member { userId: string; name: string; email: string; role: string; squadId?: string | null; squadName?: string | null; avatarUrl?: string | null }
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
  startDate: string
  plannedEndDate: string
  plannedPoints: string
  plannedHours: string
  scope: string
}
