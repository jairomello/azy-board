import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../contexts/AuthContext'
import type { BoardMode } from '@azy-board/domain'
import type {
  Column,
  CostCenter,
  Manager,
  Member,
  Module,
  ProjectSettingsData,
  ProjectVersion,
  Sprint,
  Squad,
} from '../model/types'
import { canAccessProjectSettings, updateSettingsField } from '../model/behavior'

export function useProjectSettingsData(projectId: string | undefined) {
  const { user } = useAuth()
  const [columns, setColumns] = useState<Column[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [data, setData] = useState<ProjectSettingsData>({
    projectName: '', manager: null, managerUserId: '', boardMode: 'HIERARCHICAL',
    isRestricted: false, isHidden: false, advancedChecklists: false, startDate: '', plannedEndDate: '',
    plannedPoints: '', plannedHours: '', scope: '',
  })

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      api.get<Column[]>(`/projects/${projectId}/columns`),
      api.get<Member[]>(`/projects/${projectId}/members`),
      api.get<Squad[]>(`/projects/${projectId}/squads`),
      api.get<Module[]>(`/projects/${projectId}/modules`),
      api.get<ProjectVersion[]>(`/projects/${projectId}/versions`),
      api.get<CostCenter[]>(`/projects/${projectId}/cost-centers`),
      api.get<Sprint[]>(`/projects/${projectId}/sprints`).catch(() => [] as Sprint[]),
      api.get<{
        name: string
        manager?: Manager | null
        boardMode?: BoardMode
        isRestricted?: boolean
        isHidden?: boolean
        advancedChecklists?: boolean
        startDate?: string | null
        plannedEndDate?: string | null
        plannedPoints?: number | null
        plannedHours?: number | null
        scope?: string | null
      }>(`/projects/${projectId}`),
    ]).then(([nextColumns, nextMembers, nextSquads, nextModules, nextVersions, nextCostCenters, nextSprints, project]) => {
      setColumns(nextColumns)
      setMembers(nextMembers)
      setSquads(nextSquads)
      setModules(nextModules)
      setVersions(nextVersions)
      setCostCenters(nextCostCenters)
      setSprints(nextSprints)
      setData({
        projectName: project.name,
        manager: project.manager ?? null,
        managerUserId: project.manager?.id ?? '',
        boardMode: project.boardMode ?? 'HIERARCHICAL',
        isRestricted: Boolean(project.isRestricted),
        isHidden: Boolean(project.isHidden),
        advancedChecklists: Boolean(project.advancedChecklists),
        startDate: project.startDate ?? '',
        plannedEndDate: project.plannedEndDate ?? '',
        plannedPoints: project.plannedPoints != null ? String(project.plannedPoints) : '',
        plannedHours: project.plannedHours != null ? String(project.plannedHours) : '',
        scope: project.scope ?? '',
      })
    }).catch(() => {})
  }, [projectId])

  const currentMember = members.find(member => member.userId === user?.id)
  const isAdmin = canAccessProjectSettings(user?.globalGroup) && (currentMember?.role === 'ADMIN' || ['MANAGER', 'ADMIN', 'ROOT'].includes(user?.globalGroup ?? ''))

  return {
    user,
    ...data,
     setProjectName: (value: string) => setData(previous => updateSettingsField(previous, 'projectName', value)),
     setManager: (value: Manager | null) => setData(previous => updateSettingsField(previous, 'manager', value)),
     setManagerUserId: (value: string) => setData(previous => updateSettingsField(previous, 'managerUserId', value)),
     setBoardMode: (value: BoardMode) => setData(previous => updateSettingsField(previous, 'boardMode', value)),
     setIsRestricted: (value: boolean) => setData(previous => updateSettingsField(previous, 'isRestricted', value)),
     setIsHidden: (value: boolean) => setData(previous => updateSettingsField(previous, 'isHidden', value)),
     setAdvancedChecklists: (value: boolean) => setData(previous => updateSettingsField(previous, 'advancedChecklists', value)),
     setStartDate: (value: string) => setData(previous => updateSettingsField(previous, 'startDate', value)),
     setPlannedEndDate: (value: string) => setData(previous => updateSettingsField(previous, 'plannedEndDate', value)),
     setPlannedPoints: (value: string) => setData(previous => updateSettingsField(previous, 'plannedPoints', value)),
     setPlannedHours: (value: string) => setData(previous => updateSettingsField(previous, 'plannedHours', value)),
     setScope: (value: string) => setData(previous => updateSettingsField(previous, 'scope', value)),
    columns, setColumns, members, setMembers, squads, setSquads, modules, setModules,
    versions, setVersions, costCenters, setCostCenters, sprints, setSprints,
    currentMember, isAdmin,
  }
}
