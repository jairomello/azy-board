import { useCallback, useEffect, useMemo, useRef, type SetStateAction } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { onAssistantMutation } from '../../../lib/dataEvents'
import { useWebSocket } from '../../../hooks/useWebSocket'
import { useAuth } from '../../../contexts/AuthContext'
import { queryKeys } from '../../../lib/queryKeys'
import type { ProjectMember, ProjectVersion, CostCenter } from '../../../components/ItemModal'
import type { Tag } from '../../../components/TagSelector'
import type { WsEvent, WsEventType, BoardMode } from '@azy-board/types'
import { BOARD_INCREMENTAL_EVENT_TYPES } from '../../../lib/realtimeEvents'
import {
  computeIsLeaf,
  upsertItem,
  type Column,
  type ItemData,
  type Module,
  type ProjectContext,
  type Sprint,
} from '../model/types'

// Estado remoto do board mantido na camada de cache (TanStack Query).
export interface BoardData {
  columns: Column[]
  allItems: ItemData[]
  modules: Module[]
  sprints: Sprint[]
  members: ProjectMember[]
  projectTags: Tag[]
  projectVersions: ProjectVersion[]
  projectCostCenters: CostCenter[]
  projectSquads: Array<{ id: string; name: string }>
  projectName: string
  boardMode: BoardMode
  simpleStoryId: string | null
  advancedChecklists: boolean
}

const EMPTY_BOARD: BoardData = {
  columns: [],
  allItems: [],
  modules: [],
  sprints: [],
  members: [],
  projectTags: [],
  projectVersions: [],
  projectCostCenters: [],
  projectSquads: [],
  projectName: '',
  boardMode: 'HIERARCHICAL',
  simpleStoryId: null,
  advancedChecklists: false,
}

function resolveValue<T>(previous: T, value: SetStateAction<T>): T {
  return typeof value === 'function' ? (value as (prev: T) => T)(previous) : value
}

// Reducer puro de eventos WebSocket sobre o cache do board (testável isoladamente).
export function applyBoardEvent(previous: BoardData, event: WsEvent): BoardData {
  switch (event.type) {
    case 'CARD_MOVED': {
      const { itemId, columnId, status } = event.payload as { itemId: string; columnId: string; status: string }
      return { ...previous, allItems: previous.allItems.map(item => item.id === itemId ? { ...item, columnId, status: status as ItemData['status'] } : item) }
    }
    case 'ITEM_CREATED':
      return { ...previous, allItems: upsertItem(previous.allItems, event.payload as ItemData) }
    case 'CARD_CREATED':
      return { ...previous, allItems: upsertItem(previous.allItems, event.payload as ItemData) }
    case 'MODULE_CREATED': {
      const module = event.payload as Module
      return { ...previous, modules: previous.modules.some(item => item.id === module.id) ? previous.modules : [...previous.modules, module] }
    }
    case 'ITEM_UPDATED': {
      const { itemId, ...updates } = event.payload as { itemId: string; [key: string]: unknown }
      return { ...previous, allItems: computeIsLeaf(previous.allItems.map(item => item.id === itemId ? { ...item, ...updates } : item)) }
    }
    case 'ITEM_DELETED': {
      const { itemId } = event.payload as { itemId: string }
      return { ...previous, allItems: computeIsLeaf(previous.allItems.filter(item => item.id !== itemId)) }
    }
    case 'CARD_UPDATED': {
      const { taskId, itemId, ...updates } = event.payload as { taskId?: string; itemId?: string; [key: string]: unknown }
      const id = itemId ?? taskId
      return id ? { ...previous, allItems: previous.allItems.map(item => item.id === id ? { ...item, ...updates } : item) } : previous
    }
    case 'CARD_DELETED': {
      const { itemId, taskId } = event.payload as { itemId?: string; taskId?: string }
      const id = itemId ?? taskId
      return id ? { ...previous, allItems: computeIsLeaf(previous.allItems.filter(item => item.id !== id)) } : previous
    }
    case 'TASK_CLAIMED': {
      const { itemId, taskId, assigneeId } = event.payload as { itemId?: string; taskId?: string; assigneeId: string }
      const id = itemId ?? taskId
      return id ? { ...previous, allItems: previous.allItems.map(item => item.id === id ? { ...item, assigneeId, status: 'IN_PROGRESS' } : item) } : previous
    }
    case 'SUBTASK_CREATED': {
      const { parentId: newParentId, item, task } = event.payload as { parentId: string; item?: ItemData; task?: ItemData }
      const newItem = item ?? task
      return newItem ? { ...previous, allItems: upsertItem(previous.allItems, { ...newItem, parentId: newParentId }) } : previous
    }
    case 'CHECKLIST_UPDATED': {
      const { itemId, progress } = event.payload as { itemId: string; progress: { checked: number; total: number } }
      return { ...previous, allItems: previous.allItems.map(item => item.id === itemId ? { ...item, checklistProgress: progress.total > 0 ? progress : null } : item) }
    }
    default:
      return previous
  }
}

export function useBoardData(projectId: string | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = useMemo(() => queryKeys.board(user?.id, projectId), [user?.id, projectId])

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(projectId),
    queryFn: async ({ signal }) => {
      const pid = projectId as string
      const [cols, its, mods, tags, sprs, mbrs, vers, ccs, sqs, proj] = await Promise.all([
        api.get<Column[]>(`/projects/${pid}/columns`, { signal }),
        api.get<ItemData[]>(`/projects/${pid}/items`, { signal }),
        api.get<Module[]>(`/projects/${pid}/modules`, { signal }),
        api.get<Tag[]>(`/projects/${pid}/tags`, { signal }),
        api.get<Sprint[]>(`/projects/${pid}/sprints`, { signal }).catch(() => [] as Sprint[]),
        api.get<ProjectMember[]>(`/projects/${pid}/members`, { signal }).catch(() => [] as ProjectMember[]),
        api.get<ProjectVersion[]>(`/projects/${pid}/versions`, { signal }).catch(() => [] as ProjectVersion[]),
        api.get<CostCenter[]>(`/projects/${pid}/cost-centers`, { signal }).catch(() => [] as CostCenter[]),
        api.get<{ id: string; name: string }[]>(`/projects/${pid}/squads`, { signal }).catch(() => []),
        api.get<ProjectContext>(`/projects/${pid}`, { signal }).catch(() => ({ name: '', boardMode: 'HIERARCHICAL' as const, simpleStoryId: null, advancedChecklists: false })),
      ])
      return {
        columns: cols,
        allItems: computeIsLeaf(its),
        modules: mods,
        sprints: sprs,
        members: mbrs,
        projectTags: tags,
        projectVersions: vers,
        projectCostCenters: ccs,
        projectSquads: sqs,
        projectName: proj.name,
        boardMode: proj.boardMode ?? 'HIERARCHICAL',
        simpleStoryId: proj.simpleStoryId ?? null,
        advancedChecklists: Boolean(proj.advancedChecklists),
      } satisfies BoardData
    },
  })

  const data = query.data ?? EMPTY_BOARD

  const patch = useCallback((updater: (previous: BoardData) => BoardData) => {
    queryClient.setQueryData<BoardData>(key, (previous) => previous ? updater(previous) : previous)
  }, [queryClient, key])

  const invalidateBoard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: key })
  }, [queryClient, key])

  const setColumns = useCallback((value: SetStateAction<Column[]>) => patch(prev => ({ ...prev, columns: resolveValue(prev.columns, value) })), [patch])
  const setAllItems = useCallback((value: SetStateAction<ItemData[]>) => patch(prev => ({ ...prev, allItems: resolveValue(prev.allItems, value) })), [patch])
  const setModules = useCallback((value: SetStateAction<Module[]>) => patch(prev => ({ ...prev, modules: resolveValue(prev.modules, value) })), [patch])
  const setSprints = useCallback((value: SetStateAction<Sprint[]>) => patch(prev => ({ ...prev, sprints: resolveValue(prev.sprints, value) })), [patch])
  const setMembers = useCallback((value: SetStateAction<ProjectMember[]>) => patch(prev => ({ ...prev, members: resolveValue(prev.members, value) })), [patch])
  const setProjectTags = useCallback((value: SetStateAction<Tag[]>) => patch(prev => ({ ...prev, projectTags: resolveValue(prev.projectTags, value) })), [patch])
  const setProjectVersions = useCallback((value: SetStateAction<ProjectVersion[]>) => patch(prev => ({ ...prev, projectVersions: resolveValue(prev.projectVersions, value) })), [patch])
  const setProjectCostCenters = useCallback((value: SetStateAction<CostCenter[]>) => patch(prev => ({ ...prev, projectCostCenters: resolveValue(prev.projectCostCenters, value) })), [patch])
  const setProjectSquads = useCallback((value: SetStateAction<Array<{ id: string; name: string }>>) => patch(prev => ({ ...prev, projectSquads: resolveValue(prev.projectSquads, value) })), [patch])
  const setProjectName = useCallback((value: SetStateAction<string>) => patch(prev => ({ ...prev, projectName: resolveValue(prev.projectName, value) })), [patch])
  const setBoardMode = useCallback((value: SetStateAction<BoardMode>) => patch(prev => ({ ...prev, boardMode: resolveValue(prev.boardMode, value) })), [patch])
  const setSimpleStoryId = useCallback((value: SetStateAction<string | null>) => patch(prev => ({ ...prev, simpleStoryId: resolveValue(prev.simpleStoryId, value) })), [patch])
  const setAdvancedChecklists = useCallback((value: SetStateAction<boolean>) => patch(prev => ({ ...prev, advancedChecklists: resolveValue(prev.advancedChecklists, value) })), [patch])
  // Compatibilidade de assinatura: o carregamento é derivado do estado da query.
  const setLoading = useCallback(() => {}, [])

  // Mutação feita pelo assistente invalida o board do projeto afetado.
  useEffect(() => onAssistantMutation(({ result }) => {
    const payload = result && typeof result === 'object' ? result as Record<string, unknown> : null
    const resultProjectId = typeof payload?.projectId === 'string'
      ? payload.projectId
      : payload?.project && typeof payload.project === 'object' && typeof (payload.project as Record<string, unknown>).id === 'string'
        ? (payload.project as Record<string, unknown>).id as string
        : null
    if (!resultProjectId || resultProjectId === projectId) invalidateBoard()
  }), [projectId, invalidateBoard])

  const boardHandlers = useMemo(() => {
    const handlers: Partial<Record<WsEventType, (event: WsEvent) => void>> = {}
    for (const type of BOARD_INCREMENTAL_EVENT_TYPES) {
      handlers[type] = (event) => patch(previous => applyBoardEvent(previous, event))
    }
    return handlers
  }, [patch])

  const syncState = useWebSocket(projectId ?? null, boardHandlers)

  // Reconciliação no reconnect: após uma queda, refaz a consulta ativa do projeto.
  const wasOfflineRef = useRef(false)
  useEffect(() => {
    if (syncState === 'offline') {
      wasOfflineRef.current = true
    } else if (syncState === 'synced' && wasOfflineRef.current) {
      wasOfflineRef.current = false
      invalidateBoard()
    }
  }, [syncState, invalidateBoard])

  return {
    columns: data.columns, setColumns,
    allItems: data.allItems, setAllItems,
    modules: data.modules, setModules,
    sprints: data.sprints, setSprints,
    members: data.members, setMembers,
    projectTags: data.projectTags, setProjectTags,
    projectVersions: data.projectVersions, setProjectVersions,
    versionsLoaded: Boolean(query.data),
    projectCostCenters: data.projectCostCenters, setProjectCostCenters,
    costCentersLoaded: Boolean(query.data),
    projectSquads: data.projectSquads, setProjectSquads,
    projectName: data.projectName, setProjectName,
    boardMode: data.boardMode, setBoardMode,
    simpleStoryId: data.simpleStoryId, setSimpleStoryId,
    advancedChecklists: data.advancedChecklists, setAdvancedChecklists,
    loading: query.isPending, setLoading,
    syncState,
    invalidateBoard,
  }
}
