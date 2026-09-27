import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { queryKeys } from '../../../lib/queryKeys'
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
  SettingsProject,
  Sprint,
  Squad,
} from '../model/types'
import { canAccessProjectSettings, updateSettingsField } from '../model/behavior'

export type SettingsSectionName =
  | 'columns' | 'members' | 'squads' | 'modules' | 'versions' | 'costCenters' | 'sprints' | 'project'

const EMPTY_PROJECT: ProjectSettingsData = {
  projectName: '', manager: null, managerUserId: '', boardMode: 'HIERARCHICAL',
  isRestricted: false, isHidden: false, advancedChecklists: false, startDate: '', plannedEndDate: '',
  plannedPoints: '', plannedHours: '', scope: '',
}

// Cada seção é uma consulta da camada de cache única, com chave por
// identidade/projeto/seção e AbortSignal. Os estados de formulário do General
// são de UI e são semeados a partir da consulta `project`.
export function useProjectSettingsData(projectId: string | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = useCallback(
    (section: SettingsSectionName) => queryKeys.settings(user?.id, projectId, section),
    [user?.id, projectId],
  )

  const columnsQuery = useQuery({ queryKey: key('columns'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<Column[]>(`/projects/${projectId}/columns`, { signal }) })
  const membersQuery = useQuery({ queryKey: key('members'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<Member[]>(`/projects/${projectId}/members`, { signal }) })
  const squadsQuery = useQuery({ queryKey: key('squads'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<Squad[]>(`/projects/${projectId}/squads`, { signal }) })
  const modulesQuery = useQuery({ queryKey: key('modules'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<Module[]>(`/projects/${projectId}/modules`, { signal }) })
  const versionsQuery = useQuery({ queryKey: key('versions'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<ProjectVersion[]>(`/projects/${projectId}/versions`, { signal }) })
  const costCentersQuery = useQuery({ queryKey: key('costCenters'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<CostCenter[]>(`/projects/${projectId}/cost-centers`, { signal }) })
  const sprintsQuery = useQuery({ queryKey: key('sprints'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<Sprint[]>(`/projects/${projectId}/sprints`, { signal }).catch(() => [] as Sprint[]) })
  const projectQuery = useQuery({ queryKey: key('project'), enabled: Boolean(projectId), queryFn: ({ signal }) => api.get<SettingsProject>(`/projects/${projectId}`, { signal }) })

  const columns = columnsQuery.data ?? []
  const members = membersQuery.data ?? []
  const squads = squadsQuery.data ?? []
  const modules = modulesQuery.data ?? []
  const versions = versionsQuery.data ?? []
  const costCenters = costCentersQuery.data ?? []
  const sprints = sprintsQuery.data ?? []

  // Estado de UI do formulário do General, semeadado uma vez por projeto a
  // partir da consulta `project` (o estado remoto permanece no cache).
  const [data, setData] = useState<ProjectSettingsData>(EMPTY_PROJECT)
  const seededForProject = useRef<string | null>(null)
  useEffect(() => {
    const project = projectQuery.data
    if (!project || !projectId || seededForProject.current === projectId) return
    seededForProject.current = projectId
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
  }, [projectQuery.data, projectId])

  // Padrão reconciliado: mutações pedem a invalidação da(s) seção(ões) afetada(s)
  // após o sucesso; o cache nunca é editado antes da resposta.
  const invalidate = useCallback((...sections: SettingsSectionName[]) => {
    return Promise.all(sections.map(section => queryClient.invalidateQueries({ queryKey: key(section) })))
  }, [queryClient, key])

  // Invalida todas as seções de Settings (ex.: reconexão do WebSocket).
  const invalidateAll = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.settings(user?.id, projectId) })
  }, [queryClient, user?.id, projectId])

  // Reconcilia a partir da resposta da mutação (seção `project`).
  const applyProject = useCallback((project: SettingsProject) => {
    queryClient.setQueryData(key('project'), project)
  }, [queryClient, key])

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
    columns, members, squads, modules, versions, costCenters, sprints,
    invalidate, invalidateAll, applyProject,
    currentMember, isAdmin,
  }
}
