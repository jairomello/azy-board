import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { onAssistantMutation } from '../../../lib/dataEvents'
import { useWebSocket } from '../../../hooks/useWebSocket'
import type { ProjectMember, ProjectVersion, CostCenter } from '../../../components/ItemModal'
import type { Tag } from '../../../components/TagSelector'
import type { WsEvent, BoardMode } from '@azy-board/types'
import {
  computeIsLeaf,
  upsertItem,
  type Column,
  type ItemData,
  type Module,
  type ProjectContext,
  type Sprint,
} from '../model/types'

export function useBoardData(projectId: string | undefined) {
  const [columns, setColumns] = useState<Column[]>([])
  const [allItems, setAllItems] = useState<ItemData[]>([])
  const [assistantRefresh, setAssistantRefresh] = useState(0)
  const [modules, setModules] = useState<Module[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [projectTags, setProjectTags] = useState<Tag[]>([])
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([])
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [costCentersLoaded, setCostCentersLoaded] = useState(false)
  const [projectCostCenters, setProjectCostCenters] = useState<CostCenter[]>([])
  const [projectSquads, setProjectSquads] = useState<{ id: string; name: string }[]>([])
  const [projectName, setProjectName] = useState('')
  const [boardMode, setBoardMode] = useState<BoardMode>('HIERARCHICAL')
  const [simpleStoryId, setSimpleStoryId] = useState<string | null>(null)
  const [advancedChecklists, setAdvancedChecklists] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAssistantMutation(({ result }) => {
    const payload = result && typeof result === 'object' ? result as Record<string, unknown> : null
    const resultProjectId = typeof payload?.projectId === 'string'
      ? payload.projectId
      : payload?.project && typeof payload.project === 'object' && typeof (payload.project as Record<string, unknown>).id === 'string'
        ? (payload.project as Record<string, unknown>).id as string
        : null
    if (!resultProjectId || resultProjectId === projectId) setAssistantRefresh(value => value + 1)
  }), [projectId])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setVersionsLoaded(false)
    setCostCentersLoaded(false)
    Promise.all([
      api.get<Column[]>(`/projects/${projectId}/columns`),
      api.get<ItemData[]>(`/projects/${projectId}/items`),
      api.get<Module[]>(`/projects/${projectId}/modules`),
      api.get<Tag[]>(`/projects/${projectId}/tags`),
      api.get<Sprint[]>(`/projects/${projectId}/sprints`).catch(() => [] as Sprint[]),
      api.get<ProjectMember[]>(`/projects/${projectId}/members`).catch(() => [] as ProjectMember[]),
      api.get<ProjectVersion[]>(`/projects/${projectId}/versions`).catch(() => [] as ProjectVersion[]),
      api.get<CostCenter[]>(`/projects/${projectId}/cost-centers`).catch(() => [] as CostCenter[]),
      api.get<{ id: string; name: string }[]>(`/projects/${projectId}/squads`).catch(() => []),
      api.get<ProjectContext>(`/projects/${projectId}`).catch(() => ({ name: '', boardMode: 'HIERARCHICAL' as const, simpleStoryId: null, advancedChecklists: false })),
    ]).then(([cols, its, mods, tags, sprs, mbrs, vers, ccs, sqs, proj]) => {
      setColumns(cols)
      setAllItems(computeIsLeaf(its))
      setModules(mods)
      setProjectTags(tags)
      setSprints(sprs)
      setMembers(mbrs)
      setProjectVersions(vers)
      setVersionsLoaded(true)
      setProjectCostCenters(ccs)
      setCostCentersLoaded(true)
      setProjectSquads(sqs)
      setProjectName(proj.name)
      setBoardMode(proj.boardMode ?? 'HIERARCHICAL')
      setSimpleStoryId(proj.simpleStoryId ?? null)
      setAdvancedChecklists(Boolean(proj.advancedChecklists))
    }).finally(() => setLoading(false))
  }, [assistantRefresh, projectId])

  const syncState = useWebSocket(projectId ?? null, {
    CARD_MOVED: (event: WsEvent) => {
      const { itemId, columnId, status } = event.payload as { itemId: string; columnId: string; status: string }
      setAllItems(previous => previous.map(item => item.id === itemId ? { ...item, columnId, status: status as ItemData['status'] } : item))
    },
    ITEM_CREATED: (event: WsEvent) => setAllItems(previous => upsertItem(previous, event.payload as ItemData)),
    MODULE_CREATED: (event: WsEvent) => {
      const module = event.payload as Module
      setModules(previous => previous.some(item => item.id === module.id) ? previous : [...previous, module])
    },
    ITEM_UPDATED: (event: WsEvent) => {
      const { itemId, ...updates } = event.payload as { itemId: string; [key: string]: unknown }
      setAllItems(previous => computeIsLeaf(previous.map(item => item.id === itemId ? { ...item, ...updates } : item)))
    },
    ITEM_DELETED: (event: WsEvent) => {
      const { itemId } = event.payload as { itemId: string }
      setAllItems(previous => computeIsLeaf(previous.filter(item => item.id !== itemId)))
    },
    CARD_CREATED: (event: WsEvent) => setAllItems(previous => upsertItem(previous, event.payload as ItemData)),
    CARD_UPDATED: (event: WsEvent) => {
      const { taskId, itemId, ...updates } = event.payload as { taskId?: string; itemId?: string; [key: string]: unknown }
      const id = itemId ?? taskId
      if (id) setAllItems(previous => previous.map(item => item.id === id ? { ...item, ...updates } : item))
    },
    CARD_DELETED: (event: WsEvent) => {
      const { itemId, taskId } = event.payload as { itemId?: string; taskId?: string }
      const id = itemId ?? taskId
      if (id) setAllItems(previous => computeIsLeaf(previous.filter(item => item.id !== id)))
    },
    TASK_CLAIMED: (event: WsEvent) => {
      const { itemId, taskId, assigneeId } = event.payload as { itemId?: string; taskId?: string; assigneeId: string }
      const id = itemId ?? taskId
      if (id) setAllItems(previous => previous.map(item => item.id === id ? { ...item, assigneeId, status: 'IN_PROGRESS' } : item))
    },
    SUBTASK_CREATED: (event: WsEvent) => {
      const { parentId: newParentId, item, task } = event.payload as { parentId: string; item?: ItemData; task?: ItemData }
      const newItem = item ?? task
      if (newItem) setAllItems(previous => upsertItem(previous, { ...newItem, parentId: newParentId }))
    },
    CHECKLIST_UPDATED: (event: WsEvent) => {
      const { itemId, progress } = event.payload as { itemId: string; progress: { checked: number; total: number } }
      setAllItems(previous => previous.map(item => item.id === itemId
        ? { ...item, checklistProgress: progress.total > 0 ? progress : null }
        : item
      ))
    },
  })

  return {
    columns, setColumns,
    allItems, setAllItems,
    modules, setModules,
    sprints, setSprints,
    members, setMembers,
    projectTags, setProjectTags,
    projectVersions, setProjectVersions,
    versionsLoaded,
    projectCostCenters, setProjectCostCenters,
    costCentersLoaded,
    projectSquads, setProjectSquads,
    projectName, setProjectName,
    boardMode, setBoardMode,
    simpleStoryId, setSimpleStoryId,
    advancedChecklists, setAdvancedChecklists,
    loading, setLoading,
    syncState,
  }
}
