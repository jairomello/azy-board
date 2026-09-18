import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
} from '@dnd-kit/sortable'
import { api } from '../../lib/api'
import { KanbanCard } from '../../components/KanbanCard'
import type { FullItemData } from '../../components/ItemModal'
import type { EpicData } from '../../components/EpicModal'
import type { StoryData } from '../../components/StoryModal'
import { ActiveFilterChips, removeActiveBoardFilter, type ActiveFilterKey } from '../../components/ActiveFilterChips'
import { useToast } from '../../components/Toast'
import { TreeViewPage, type TreeActionContext } from '../../pages/TreeViewPage'
import { useAuth } from '../../contexts/AuthContext'
import { AppShell } from '../../components/AppShell'
import { BoardCommandBar } from '../../components/BoardCommandBar'
import { BoardContextHeader, BoardStatusRail } from '../../components/BoardContext'
import type { AncestorNode, ItemType } from '@azy-board/types'
import type { Tag } from '../../components/TagSelector'
import { useBoardPreferences } from './hooks/useBoardPreferences'
import { useBoardData } from './hooks/useBoardData'
import { BoardLanes } from './components/BoardLanes'
import { BoardModals } from './components/BoardModals'
import { useBoardInteraction } from './hooks/useBoardInteraction'
import { buildBoardItemCreatePayload, resolveBoardModalTarget } from './model/interaction'
import {
  computeIsLeaf,
  getEpicIdFromPath,
  getStoryIdFromPath,
  upsertItem,
  type ArchivedItem,
  type ItemData,
  type Module,
  type StoryLaneGroup,
} from './model/types'

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const { t: tBoard } = useTranslation('board')
  const { user } = useAuth()
  const { toast } = useToast()

  const {
    columns, setColumns,
    allItems, setAllItems,
    modules, setModules,
    sprints, setSprints,
    members, setMembers,
    projectTags, setProjectTags,
    projectVersions, setProjectVersions,
    versionsLoaded,
    costCentersLoaded,
    projectCostCenters, setProjectCostCenters,
    projectSquads, setProjectSquads,
    projectName, setProjectName,
    boardMode, setBoardMode,
    simpleStoryId, setSimpleStoryId,
    loading, setLoading,
    syncState,
  } = useBoardData(projectId)
  const [activeId, setActiveId] = useState<string | null>(null)
  const {
    collapsedEpics,
    collapsedModules,
    collapsedStories,
    setCollapsedEpics,
    setCollapsedModules,
    setCollapsedStories,
    density,
    setDensity,
    filters,
    setFilters,
    toggleEpic,
    toggleModule,
    toggleStory,
  } = useBoardPreferences(projectId)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [view, setView] = useState<'kanban' | 'tree'>('kanban')
  const [itemModalId, setItemModalId] = useState<string | null>(null)
  const [storyModalData, setStoryModalData] = useState<{ story?: StoryData } | null>(null)
  const [epicModalData, setEpicModalData] = useState<{ epic?: EpicData } | null>(null)
  const [columnAddForms, setColumnAddForms] = useState<Record<string, boolean>>({})
  const [newItemCreation, setNewItemCreation] = useState<{ type: 'TASK' | 'BUG'; columnId?: string; costCenterId?: string | null; title?: string; parentId?: string } | null>(null)
  const [treeRefreshToken, setTreeRefreshToken] = useState(0)
  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [newModuleDescription, setNewModuleDescription] = useState('')
  // Tarefa 10 — arquivamento
  const [archiveConfirm, setArchiveConfirm] = useState<{ itemId: string; childrenCount: number } | null>(null)
  const [archivedModal, setArchivedModal] = useState(false)
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)

  useEffect(() => {
    const itemId = searchParams.get('itemId')
    if (itemId && allItems.some(item => item.id === itemId)) setItemModalId(itemId)
  }, [allItems, searchParams])

  // Ref para preservar o over ID mais recente durante o drag (evita perder o alvo no momento do drop)
  const lastOverRef = useRef<string | null>(null)


  useEffect(() => {
    if (versionsLoaded && filters.versionId && !projectVersions.some(version => version.id === filters.versionId)) {
      setFilters(previous => ({ ...previous, versionId: '' }))
    }
  }, [filters.versionId, projectVersions, versionsLoaded])

  useEffect(() => {
    if (filters.sprintId && sprints.length > 0 && !sprints.some(sprint => sprint.id === filters.sprintId)) {
      setFilters(previous => ({ ...previous, sprintId: '' }))
    }
  }, [filters.sprintId, sprints])

  useEffect(() => {
    if (costCentersLoaded && filters.costCenterId && !projectCostCenters.some(center => center.id === filters.costCenterId)) {
      setFilters(previous => ({ ...previous, costCenterId: '' }))
    }
  }, [filters.costCenterId, projectCostCenters, costCentersLoaded])

  useEffect(() => {
    document.title = projectName ? `${projectName} · Board` : 'Board'
    return () => { document.title = 'Board' }
  }, [projectName])


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Prioriza elementos menores (cards) sobre elementos maiores (colunas) na detecção de colisão
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args)
    if (hits.length > 0) {
      const itemIds = new Set(allItems.map(item => item.id))
      return [...hits].sort((left, right) => {
        const score = (id: string) => itemIds.has(id) ? 0 : id.includes(':drop:') ? 1 : id.includes(':col:') ? 2 : 3
        return score(left.id.toString()) - score(right.id.toString())
      })
    }
    return rectIntersection(args)
  }, [allItems])

  // Mapa squadId → Set<userId> para filtro de squad O(1)
  const squadMembersMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const m of members) {
      if (m.squadId) {
        if (!map.has(m.squadId)) map.set(m.squadId, new Set())
        map.get(m.squadId)!.add(m.userId)
      }
    }
    return map
  }, [members])

  // Items derivados por tipo
  const epics = useMemo(() => allItems.filter(i => i.type === 'EPIC'), [allItems])
  const stories = useMemo(() => allItems.filter(i => i.type === 'STORY'), [allItems])
  const simpleStory = useMemo(() => (
    stories.find(story => story.id === simpleStoryId) ?? stories.find(story => !story.parentId)
  ), [simpleStoryId, stories])
  const isSimpleBoard = boardMode === 'SIMPLE'

  useEffect(() => {
    if (isSimpleBoard && filters.moduleId) {
      setFilters(prev => ({ ...prev, moduleId: '' }))
    }
  }, [isSimpleBoard, filters.moduleId])

  // IDs das STORYs — usados para identificar TASK/BUG de primeiro nível
  const storyIdSet = useMemo(() => new Set(stories.map(s => s.id)), [stories])

  // Cards para o board
  //   showSubtasks = false ("Mostrar subtasks"): mostra TASK/BUG de primeiro nível
  //     = cujo parentId aponta para uma STORY, ou sem parentId (órfãos)
  //   showSubtasks = true  ("Ocultar subtasks"): Leaf Rule
  //     = só TASK/BUG sem filhos (subtasks ficam visíveis, pais somem)
  const boardCards = useMemo(() => {
    let result: ItemData[]
    if (filters.showSubtasks) {
      // Leaf Rule: itens TASK/BUG que não são pai de nenhum outro item
      const parentIdSet = new Set(allItems.map(i => i.parentId).filter(Boolean) as string[])
      result = allItems.filter(i => ['TASK', 'BUG'].includes(i.type) && !parentIdSet.has(i.id))
    } else {
      // Primeiro nível: TASK/BUG cujo pai imediato é uma STORY (ou sem pai = órfão)
      result = allItems.filter(i =>
        ['TASK', 'BUG'].includes(i.type) &&
        (!i.parentId || storyIdSet.has(i.parentId))
      )
    }

    if (filters.moduleId) {
      const epicIds = new Set(epics.filter(e => e.moduleId === filters.moduleId).map(e => e.id))
      result = result.filter(i => {
        const epicId = getEpicIdFromPath(i.ancestryPath)
        return epicId ? epicIds.has(epicId) : false
      })
    }
    if (filters.assigneeId) {
      result = result.filter(i => i.assigneeId === filters.assigneeId || i.assignee?.id === filters.assigneeId)
    }
    if (filters.squadId) {
      const squadUsers = squadMembersMap.get(filters.squadId)
      result = result.filter(i => {
        const uid = i.assigneeId ?? i.assignee?.id
        return uid != null && squadUsers?.has(uid)
      })
    }
    if (filters.types.length > 0) {
      result = result.filter(i => filters.types.includes(i.type as ItemType))
    }
    if (filters.tagIds.length > 0) {
      result = result.filter(i =>
        (i.itemTags ?? i.taskTags ?? []).some((it: { tag: Tag }) => filters.tagIds.includes(it.tag.id))
      )
    }
    if (filters.sprintId) {
      result = result.filter(i => i.itemSprints?.some(sprint => sprint.sprintId === filters.sprintId))
    }
    if (filters.versionId) result = result.filter(i => i.versionId === filters.versionId)
    if (filters.priority) result = result.filter(i => i.priority === filters.priority)
    if (filters.status) result = result.filter(i => i.status === filters.status)
    if (filters.authorId) result = result.filter(i => i.authorId === filters.authorId || i.author?.id === filters.authorId)
    if (filters.costCenterId) result = result.filter(i => i.costCenterId === filters.costCenterId)

    // Histórias folha (sem filhos) — aparecem como cards arrastáveis quando "Histórias no board" ativo
    if (!isSimpleBoard && filters.storyDisplay === 'cards' && columns.length > 0) {
      const firstColId = columns[0]!.id
      let leafStories = stories
        .filter(s => s.isLeaf)
        .map(s => ({ ...s, columnId: s.columnId ?? firstColId }))
      if (filters.moduleId) {
        const epicIds = new Set(epics.filter(e => e.moduleId === filters.moduleId).map(e => e.id))
        leafStories = leafStories.filter(i => {
          const epicId = getEpicIdFromPath(i.ancestryPath)
          return epicId ? epicIds.has(epicId) : false
        })
      }
      if (filters.assigneeId) {
        leafStories = leafStories.filter(i => i.assigneeId === filters.assigneeId || i.assignee?.id === filters.assigneeId)
      }
      if (filters.squadId) {
        const squadUsers = squadMembersMap.get(filters.squadId)
        leafStories = leafStories.filter(i => {
          const uid = i.assigneeId ?? i.assignee?.id
          return uid != null && squadUsers?.has(uid)
        })
      }
      if (filters.tagIds.length > 0) {
        leafStories = leafStories.filter(i =>
          (i.itemTags ?? i.taskTags ?? []).some((it: { tag: Tag }) => filters.tagIds.includes(it.tag.id))
        )
      }
      if (filters.sprintId) {
        leafStories = leafStories.filter(i => i.itemSprints?.some(sprint => sprint.sprintId === filters.sprintId))
      }
      if (filters.versionId) leafStories = leafStories.filter(i => i.versionId === filters.versionId)
      if (filters.priority) leafStories = leafStories.filter(i => i.priority === filters.priority)
      if (filters.status) leafStories = leafStories.filter(i => i.status === filters.status)
      if (filters.authorId) leafStories = leafStories.filter(i => i.authorId === filters.authorId || i.author?.id === filters.authorId)
      if (filters.costCenterId) leafStories = leafStories.filter(i => i.costCenterId === filters.costCenterId)
      result = [...result, ...leafStories]
    }

    return result
  }, [allItems, filters, storyIdSet, epics, squadMembersMap, columns, stories, isSimpleBoard])

  // Cards virtuais de histórias NÃO-folha quando toggle "Mostrar histórias" ativo
  // Histórias folha aparecem como cards reais em boardCards (arrastáveis)
  const storyVirtualCards: ItemData[] = useMemo(() => {
    if (filters.storyDisplay !== 'cards' || columns.length === 0) return []
    const firstColId = columns[0]!.id
    return stories
      .filter(s => !s.isLeaf)
      .map(s => ({
        ...s,
        id: `story-virtual-${s.id}`,
        columnId: firstColId,
        isLeaf: false,
      }))
  }, [filters.storyDisplay, stories, columns])

  const allDisplayed = useMemo(() => [...boardCards, ...storyVirtualCards], [boardCards, storyVirtualCards])
  const handleDragEnd = useBoardInteraction({
    projectId,
    columns,
    items: allItems,
    displayedItems: allDisplayed,
    setColumns,
    setItems: setAllItems,
    onError: toast,
  })

  // Agrupar por EPIC. No modo de lanes, cada grupo contém também as histórias
  // do épico e seus cards visíveis, formando EPIC → STORY → CARD.
  const epicGroups = useMemo(() => {
    const hideEmpty = filters.hideEmptyEpics || !!filters.squadId
    return epics
      .map(epic => {
        const epicCards = allDisplayed.filter(i =>
          getEpicIdFromPath(i.ancestryPath) === epic.id
        )
        const storyGroups: StoryLaneGroup[] = filters.storyDisplay === 'lanes'
          ? stories
              .filter(story => story.parentId === epic.id || getEpicIdFromPath(story.ancestryPath) === epic.id)
              .map(story => ({
                id: story.id,
                title: story.title,
                story,
                tasks: epicCards.filter(card => getStoryIdFromPath(card.ancestryPath) === story.id),
              }))
              .filter(group => !filters.hideEmptyStories || group.tasks.length > 0)
          : []

        if (filters.storyDisplay === 'lanes') {
          const cardsWithoutStory = epicCards.filter(card => !getStoryIdFromPath(card.ancestryPath))
          if (cardsWithoutStory.length > 0) {
            storyGroups.push({
              id: `no-story-${epic.id}`,
              title: 'Sem história',
              story: undefined,
              tasks: cardsWithoutStory,
            })
          }
        }

        return { epic, tasks: epicCards, storyGroups }
      })
      .filter(group => !hideEmpty || group.tasks.length > 0)
  }, [
    epics,
    stories,
    allDisplayed,
    filters.hideEmptyEpics,
    filters.hideEmptyStories,
    filters.squadId,
    filters.storyDisplay,
  ])

  const orphanCards = useMemo(() =>
    allDisplayed.filter(i => ['TASK', 'BUG'].includes(i.type) && !getEpicIdFromPath(i.ancestryPath) && !i.id.startsWith('story-virtual-')),
    [allDisplayed]
  )

  const moduleGroups = useMemo(() => {
    if (isSimpleBoard) return []
    const groups = new Map<string, { module: Module; epics: typeof epicGroups }>()
    for (const group of epicGroups) {
      const moduleId = group.epic.moduleId ?? '__no-module__'
      const module = modules.find(item => item.id === moduleId) ?? { id: moduleId, name: tBoard('noModule'), position: Number.MAX_SAFE_INTEGER }
      const existing = groups.get(moduleId)
      if (existing) existing.epics.push(group)
      else groups.set(moduleId, { module, epics: [group] })
    }
    return [...groups.values()].sort((a, b) => (a.module.position ?? Number.MAX_SAFE_INTEGER) - (b.module.position ?? Number.MAX_SAFE_INTEGER))
  }, [epicGroups, modules, tBoard, isSimpleBoard])

  useEffect(() => {
    if (moduleGroups.length === 0) {
      setActiveModuleId(null)
      return
    }
    setActiveModuleId(current => moduleGroups.some(group => group.module.id === current) ? current : moduleGroups[0]!.module.id)
  }, [moduleGroups])

  async function handleLegacyDragEnd(event: DragEndEvent, effectiveOverStr?: string) {
    const { active, over } = event
    setActiveId(null)
    const overStr = effectiveOverStr ?? over?.id?.toString()
    if (!overStr || !projectId) return

    const activeStr = active.id.toString()

    // Drag de coluna
    if (activeStr.includes(':col:')) {
      const activeColId = activeStr.split(':col:')[1]!
      const overColId = overStr.includes(':col:')
        ? overStr.split(':col:')[1]!
        : overStr.includes(':drop:')
          ? overStr.split(':drop:')[1]!
          : null
      if (!overColId || activeColId === overColId) return

      const oldIndex = columns.findIndex(c => c.id === activeColId)
      const newIndex = columns.findIndex(c => c.id === overColId)
      if (oldIndex === -1 || newIndex === -1) return

      const newCols = arrayMove(columns, oldIndex, newIndex)
      setColumns(newCols)
      try {
        await api.patch(`/projects/${projectId}/columns/reorder`, { order: newCols.map(c => c.id) })
      } catch {
        setColumns(columns)
        toast('Erro ao reordenar colunas', 'error')
      }
      return
    }

    const itemId = activeStr
    const item = allItems.find(i => i.id === itemId)
    // EPIC nunca é movível; STORY folha (sem filhos) pode ser movida como uma task
    if (!item || !item.isLeaf || item.type === 'EPIC') return

    const colIds = new Set(columns.map(c => c.id))
    let targetColId: string | undefined

    if (colIds.has(overStr)) {
      targetColId = overStr
    } else if (overStr.includes(':drop:')) {
      const extracted = overStr.split(':drop:').pop()
      if (extracted && colIds.has(extracted)) targetColId = extracted
    } else if (overStr.includes(':col:')) {
      const extracted = overStr.split(':col:').pop()
      if (extracted && colIds.has(extracted)) targetColId = extracted
    } else {
      targetColId = allItems.find(i => i.id === overStr)?.columnId ?? undefined
    }

    if (!targetColId) return

    // Reordenação vertical (mesma coluna)
    // overStr deve ser um card ID — se for coluna, ignora (drop em espaço vazio).
    // Exclui story-virtual cards pois não existem no banco e contaminariam os positions.
    if (item.columnId === targetColId) {
      const colItems = allDisplayed
        .filter(i => i.columnId === targetColId && !i.id.startsWith('story-virtual-'))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const oldIdx = colItems.findIndex(i => i.id === itemId)
      const newIdx = colItems.findIndex(i => i.id === overStr)
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return

      const reordered = arrayMove(colItems, oldIdx, newIdx)
      const positionMap = Object.fromEntries(reordered.map((i, pos) => [i.id, pos]))
      const snapshot = allItems.map(i => ({ ...i }))
      setAllItems(prev => prev.map(i => positionMap[i.id] !== undefined ? { ...i, position: positionMap[i.id] } : i))
      try {
        await api.patch(`/projects/${projectId}/items/reorder`, {
          columnId: targetColId,
          order: reordered.map(i => i.id),
        })
      } catch {
        setAllItems(snapshot)
        toast('Erro ao reordenar', 'error')
      }
      return
    }

    // Mudança de coluna
    const prevItem = { ...item }
    const targetCol = columns.find(c => c.id === targetColId)
    if (targetCol) {
      setAllItems(prev => prev.map(i => i.id === itemId
        ? { ...i, columnId: targetColId!, status: targetCol.baseStatus as ItemData['status'] }
        : i
      ))
    }
    try {
      await api.patch(`/projects/${projectId}/items/${itemId}/move`, { columnId: targetColId })
    } catch {
      setAllItems(prev => prev.map(i => i.id === itemId ? prevItem : i))
      toast('Erro ao mover card', 'error')
    }
  }

  // Cria novo item TASK/BUG via modal (botões da toolbar)
  const handleModalCreate = useCallback(async (_itemId: string, changes: Partial<FullItemData>, tagIds: string[]) => {
    if (!projectId || !newItemCreation) return
    const created = await api.post<ItemData>(`/projects/${projectId}/items`, {
      ...changes,
      type: newItemCreation.type,
      columnId: newItemCreation.columnId ?? columns[0]?.id,
    })
    setAllItems(prev => upsertItem(prev, created))
    setTreeRefreshToken(value => value + 1)
    if (tagIds.length > 0) {
      await api.post(`/projects/${projectId}/items/${created.id}/tags`, { tagIds })
    }
  }, [projectId, newItemCreation, columns])

  const handleCardCreate = useCallback(async (
    columnId: string,
    title: string,
    type: ItemType,
    parentId?: string,
    formKey?: string,
    versionId?: string,
    sprintId?: string,
  ) => {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items`, buildBoardItemCreatePayload(title, columnId, type, parentId, versionId, sprintId))
      setTreeRefreshToken(value => value + 1)
      setColumnAddForms(prev => ({ ...prev, [formKey ?? columnId]: false }))
    } catch {
      toast('Erro ao criar card', 'error')
      throw new Error('failed')
    }
  }, [projectId, toast])

  const handleTitleSave = useCallback(async (itemId: string, title: string) => {
    if (!projectId) return
    setAllItems(prev => prev.map(i => i.id === itemId ? { ...i, title } : i))
    try {
      await api.patch(`/projects/${projectId}/items/${itemId}`, { title })
    } catch {
      toast('Erro ao salvar título', 'error')
    }
  }, [projectId, toast])

  const handleModalSave = useCallback(async (itemId: string, changes: Partial<FullItemData>, tagIds: string[]) => {
    if (!projectId) return
    try {
      await api.patch(`/projects/${projectId}/items/${itemId}`, changes)
      await api.post(`/projects/${projectId}/items/${itemId}/tags`, { tagIds })
      // Recarregar todos os itens quando parentId mudou (ancestryPath muda no servidor)
      // ou sempre para garantir consistência após salvar pela modal
      const its = await api.get<ItemData[]>(`/projects/${projectId}/items`)
      setAllItems(computeIsLeaf(its))
      setTreeRefreshToken(value => value + 1)
    } catch {
      toast('Erro ao salvar item', 'error')
      throw new Error('failed')
    }
  }, [projectId, toast])

  const handleAddSubtask = useCallback(async (parentId: string, title: string, type: ItemType) => {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items`, { title, parentId, type })
      setTreeRefreshToken(value => value + 1)
      toast('Subtask criada', 'success')
    } catch {
      toast('Erro ao criar subtask', 'error')
      throw new Error('failed')
    }
  }, [projectId, toast])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!projectId) return
    try {
      await api.delete(`/projects/${projectId}/items/${itemId}`)
      setAllItems(prev => computeIsLeaf(prev.filter(i => i.id !== itemId && i.parentId !== itemId)))
      // Recarrega para garantir consistência após cascata profunda
      const its = await api.get<ItemData[]>(`/projects/${projectId}/items`)
      setAllItems(computeIsLeaf(its))
      toast('Item excluído', 'success')
    } catch {
      toast('Erro ao excluir item', 'error')
    }
  }, [projectId, toast])

  // Tarefa 10.1 — arquivamento de cards
  const handleArchiveRequest = useCallback((itemId: string) => {
    // Conta descendentes não-arquivados para mostrar confirmação quando há filhos
    const item = allItems.find(i => i.id === itemId)
    if (!item) return
    const childrenCount = allItems.filter(i => {
      try {
        const path: AncestorNode[] = JSON.parse(i.ancestryPath || '[]')
        return path.some(a => a.id === itemId)
      } catch { return false }
    }).length
    if (childrenCount > 0) {
      setArchiveConfirm({ itemId, childrenCount })
    } else {
      executeArchive(itemId)
    }
  }, [allItems]) // eslint-disable-line react-hooks/exhaustive-deps

  async function executeArchive(itemId: string) {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/archive`, {})
      // Tarefa 10.3 — remover item e descendentes da UI imediatamente
      setAllItems(prev => computeIsLeaf(prev.filter(i => {
        if (i.id === itemId) return false
        try {
          const path: AncestorNode[] = JSON.parse(i.ancestryPath || '[]')
          return !path.some(a => a.id === itemId)
        } catch { return true }
      })))
      setArchiveConfirm(null)
      toast('Item arquivado', 'success')
    } catch {
      toast('Erro ao arquivar item', 'error')
    }
  }

  // Tarefa 10.4/10.5 — carregar e exibir itens arquivados
  async function openArchivedModal() {
    if (!projectId) return
    setArchivedModal(true)
    setArchivedLoading(true)
    try {
      const items = await api.get<ArchivedItem[]>(`/projects/${projectId}/items/archived`)
      setArchivedItems(items)
    } catch {
      setArchivedItems([])
    } finally {
      setArchivedLoading(false)
    }
  }

  // Tarefa 10.6 — restaurar item arquivado
  async function handleUnarchive(itemId: string) {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/unarchive`, {})
      setArchivedItems(prev => prev.filter(i => i.id !== itemId))
      // Re-fetch de todos os itens para garantir que o restaurado apareça no board
      const its = await api.get<ItemData[]>(`/projects/${projectId}/items`)
      setAllItems(computeIsLeaf(its))
      toast('Item restaurado', 'success')
    } catch {
      toast('Erro ao restaurar item', 'error')
    }
  }

  const handleCreateTag = useCallback(async (name: string, color: string): Promise<Tag> => {
    if (!projectId) throw new Error('no project')
    const tag = await api.post<Tag>(`/projects/${projectId}/tags`, { name, color })
    setProjectTags(prev => [...prev, tag])
    return tag
  }, [projectId])

  const handleEditTag = useCallback(async (tagId: string, name: string, color: string) => {
    if (!projectId) return
    await api.patch(`/projects/${projectId}/tags/${tagId}`, { name, color })
    setProjectTags(prev => prev.map(t => t.id === tagId ? { ...t, name, color } : t))
  }, [projectId])

  // Salvar história via /items
  const handleStorySave = useCallback(async (data: StoryData) => {
    if (!projectId) return
    if (data.id) {
      await api.patch(`/projects/${projectId}/items/${data.id}`, {
        title: data.title,
        parentId: data.epicId,
        persona: data.persona,
        goal: data.goal,
        benefit: data.benefit,
        acceptanceCriteria: data.acceptanceCriteria,
        notes: data.notes,
        description: data.description,
        versionId: data.versionId,
        sequenceCode: data.sequenceCode,
      })
       setAllItems(prev => prev.map(i => i.id === data.id ? { ...i, title: data.title } : i))
       setTreeRefreshToken(value => value + 1)
    } else {
      const item = await api.post<ItemData>(`/projects/${projectId}/items`, {
        type: 'STORY',
        parentId: data.epicId,
        title: data.title,
        persona: data.persona,
        goal: data.goal,
        benefit: data.benefit,
        acceptanceCriteria: data.acceptanceCriteria,
        notes: data.notes,
        description: data.description,
        versionId: data.versionId,
        sequenceCode: data.sequenceCode,
      })
       setAllItems(prev => upsertItem(prev, item))
       setTreeRefreshToken(value => value + 1)
    }
  }, [projectId])

  // Criar história inline (para StorySelector no ItemModal)
  const handleCreateStory = useCallback(async (title: string, epicId: string) => {
    if (!projectId) throw new Error('no project')
    const item = await api.post<ItemData>(`/projects/${projectId}/items`, {
      type: 'STORY',
      parentId: epicId,
      title,
    })
    setAllItems(prev => upsertItem(prev, item))
    return { id: item.id, title: item.title, epicId }
  }, [projectId])

  // Salvar épico via /items
  const handleEpicSave = useCallback(async (data: EpicData) => {
    if (!projectId) return
    if (data.id) {
      await api.patch(`/projects/${projectId}/items/${data.id}`, {
        title: data.title,
        moduleId: data.moduleId,
        description: data.description,
        versionId: data.versionId,
        sequenceCode: data.sequenceCode,
      })
      setAllItems(prev => prev.map(i => i.id === data.id ? { ...i, ...data } : i))
    } else {
      const item = await api.post<ItemData>(`/projects/${projectId}/items`, {
        type: 'EPIC',
        moduleId: data.moduleId,
        title: data.title,
        description: data.description,
        versionId: data.versionId,
        sequenceCode: data.sequenceCode,
      })
      setAllItems(prev => upsertItem(prev, item))
    }
  }, [projectId])

  async function handleModuleCreate() {
    if (!projectId || !newModuleName.trim()) return
    try {
      const created = await api.post<Module>(`/projects/${projectId}/modules`, {
        name: newModuleName.trim(),
        description: newModuleDescription.trim() || undefined,
      })
      const refreshed = await api.get<Module[]>(`/projects/${projectId}/modules`)
       setModules(refreshed.length > 0 ? refreshed : [...modules, created])
       setTreeRefreshToken(value => value + 1)
      setNewModuleName('')
      setNewModuleDescription('')
      setModuleModalOpen(false)
      toast('Módulo criado', 'success')
    } catch {
      toast('Erro ao criar módulo', 'error')
    }
  }

  const isColumnDrag = activeId?.includes(':col:') ?? false
  const activeCard = !isColumnDrag ? allItems.find(i => i.id === activeId) : null
  const assistantSelectedItem = useMemo(() => {
    const selectedId = itemModalId ?? storyModalData?.story?.id ?? epicModalData?.epic?.id
    const selected = selectedId ? allItems.find(item => item.id === selectedId) : undefined
    if (!selected) return null
    let ancestry: AncestorNode[] = []
    try {
      const parsed = JSON.parse(selected.ancestryPath || '[]')
      if (Array.isArray(parsed)) ancestry = parsed.filter(node => node && typeof node.id === 'string' && typeof node.title === 'string' && typeof node.type === 'string')
    } catch {
      ancestry = []
    }
    return { id: selected.id, title: selected.title, type: selected.type, ancestry }
  }, [allItems, epicModalData?.epic?.id, itemModalId, storyModalData?.story?.id])

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  const itemForModal = itemModalId ? allItems.find(i => i.id === itemModalId) : null

  function openStoryModal(story: ItemData) {
    setStoryModalData({
      story: {
        id: story.id,
        title: story.title,
        epicId: story.parentId ?? '',
        persona: story.persona,
        goal: story.goal,
        benefit: story.benefit,
        acceptanceCriteria: story.acceptanceCriteria,
        notes: story.notes,
        description: story.description,
      } as StoryData,
    })
  }

  function handleOpenDetail(id: string) {
    if (id.startsWith('story-virtual-')) {
      const storyId = id.replace('story-virtual-', '')
      const story = stories.find(s => s.id === storyId)
      if (story) openStoryModal(story)
    } else {
      const target = resolveBoardModalTarget(id, allItems)
      if (target?.kind === 'story') {
        openStoryModal(target.item)
      } else {
        setItemModalId(id)
      }
    }
  }

  // Abertura de filho a partir das modais de Épico/História: substitui a modal
  // atual pela modal correta do filho (STORY → StoryModal; TASK/BUG → ItemModal).
  function handleOpenChildFromHierarchy(childId: string) {
    setEpicModalData(null)
    setStoryModalData(null)
    handleOpenDetail(childId)
  }

  // Mapa stories para o StorySelector: parentId → epicId
  const storiesForSelector = stories.map(s => ({
    id: s.id,
    title: s.title,
    epicId: s.parentId ?? '',
  }))

  // Epics para StorySelector/StoryModal
  const epicsForModal = epics.map(e => ({ id: e.id, title: e.title }))

  const activeSprint = sprints.find(sprint => sprint.status === 'OPEN')
  const sprintItems = activeSprint
    ? allItems.filter(item => item.itemSprints?.some(link => link.sprintId === activeSprint.id))
    : allDisplayed
  const sprintCompleted = sprintItems.filter(item => item.status === 'DONE').length

  function openCreation(type: ItemType | 'MODULE', context: TreeActionContext = {}) {
    if (type === 'MODULE') {
      setModuleModalOpen(true)
    } else if (type === 'EPIC') {
      setEpicModalData({ epic: context.moduleId ? { title: '', moduleId: context.moduleId } : undefined })
    } else if (type === 'STORY') {
      setStoryModalData({ story: context.parentId ? { title: '', epicId: context.parentId } : undefined })
    } else {
      setNewItemCreation({
        type,
        columnId: columns[0]?.id,
        costCenterId: projectCostCenters[0]?.id ?? null,
        parentId: context.parentId,
        title: type === 'TASK' ? 'Nova Task' : 'Novo Bug',
      })
    }
  }

  const visibleModuleGroups = filters.moduleViewMode === 'tabs'
    ? moduleGroups.filter(group => group.module.id === activeModuleId)
    : moduleGroups

  const activeFilterLabels = {
    filterLabel: tBoard('activeFilters'), module: tBoard('filterModule'), sprint: tBoard('filterSprint'), version: tBoard('filterVersion'),
    squad: tBoard('filterSquad'), assignee: tBoard('filterAssignee'), author: tBoard('filterAuthor'), costCenter: tBoard('filterCostCenter'),
    priority: tBoard('filterPriority'), status: tBoard('filterStatus'), type: tBoard('filterType'), tag: tBoard('filterTag'),
    hideEmptyEpics: tBoard('hideEmptyEpics'), hideEmptyStories: tBoard('hideEmptyStories'), showSubtasks: tBoard('showSubtasks'),
    storyDisplay: tBoard('storyDisplay'), moduleViewMode: tBoard('moduleViewMode'), typeValues: { TASK: tBoard('typeTask'), BUG: tBoard('typeBug') },
    priorityValues: { LOW: tBoard('priorityLow'), MEDIUM: tBoard('priorityMedium'), HIGH: tBoard('priorityHigh'), CRITICAL: tBoard('priorityCritical') },
    statusValues: { NOT_STARTED: tBoard('statusNotStarted'), IN_PROGRESS: tBoard('statusInProgress'), BLOCKED: tBoard('statusBlocked'), DONE: tBoard('statusDone'), CANCELLED: tBoard('statusCancelled') },
    storyDisplayCards: tBoard('storyDisplayCards'), moduleViewTabs: tBoard('moduleViewTabs'), enabled: tBoard('enabled'), remove: tBoard('removeFilter'),
  }

  return (
    <AppShell
           projectId={projectId!}
      projectName={projectName}
      assistantSelectedItem={assistantSelectedItem}
      assistantScreen={view === 'tree' ? 'project-board-tree' : 'project-board-kanban'}
      assistantBoardView={view}
      assistantFilters={{ hideEmptyEpics: filters.hideEmptyEpics, hideEmptyStories: filters.hideEmptyStories, moduleId: filters.moduleId || null, sprintId: filters.sprintId || null, versionId: filters.versionId || null, squadId: filters.squadId || null, assigneeId: filters.assigneeId || null, types: filters.types.length ? filters.types.join(',') : null }}
       sectionLabel={view === 'kanban' ? tBoard('viewBoard') : tBoard('viewTree')}
       contextLabel={activeSprint?.name ?? tBoard('optionsDescription')}
      headerMeta={syncState === 'synced' ? (
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-shell-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-status-done" />
           {tBoard('synced')}
        </span>
      ) : undefined}
      commandBar={(
        <BoardCommandBar
          view={view}
          onViewChange={setView}
          density={density}
          onDensityChange={setDensity}
           modules={modules}
           boardMode={boardMode}
          sprints={sprints}
          members={members}
          squads={projectSquads}
          tags={projectTags}
           versions={projectVersions}
           costCenters={projectCostCenters}
           filters={filters}
          onFiltersChange={setFilters}
           onExpandAll={() => {
            setCollapsedModules(new Set())
            setCollapsedEpics(new Set())
            setCollapsedStories(new Set())
          }}
           onCollapseAll={() => {
            setCollapsedModules(new Set(moduleGroups.map(group => group.module.id)))
            setCollapsedEpics(new Set([...epics.map(e => e.id), 'orphan']))
            setCollapsedStories(new Set(
              epicGroups.flatMap(group => group.storyGroups.map(storyGroup => storyGroup.id))
            ))
          }}
          onOpenArchived={openArchivedModal}
          onCreate={openCreation}
        />
      )}
      statusRail={<BoardStatusRail syncState={syncState} visibleItems={allDisplayed.length} />}
      contentClassName="overflow-hidden"
    >
      <div className="h-full min-h-0 flex flex-col gap-3">
        <ActiveFilterChips
          filters={filters}
          catalogs={{ modules, sprints, versions: projectVersions, squads: projectSquads, members, tags: projectTags, costCenters: projectCostCenters }}
          labels={activeFilterLabels}
          visualContext={{ isSimpleBoard, view }}
          onRemove={(key: ActiveFilterKey, value) => setFilters(previous => removeActiveBoardFilter(previous, key, value))}
        />
        <BoardContextHeader
          sprintName={activeSprint?.name}
          completed={sprintCompleted}
          total={sprintItems.length}
        />
        <div className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-border/80 bg-canvas ${density === 'compact' ? 'density-compact' : ''}`}>
        {view === 'tree' && projectId && (
           <TreeViewPage
           projectId={projectId!}
             filters={filters}
             canCreate={members.find(member => member.userId === user?.id)?.role !== 'VIEWER'}
             canEdit={members.find(member => member.userId === user?.id)?.role !== 'VIEWER'}
             refreshToken={treeRefreshToken}
             onCreate={openCreation}
             onEdit={handleOpenDetail}
            // Tarefa 10.2 — passa o handler de arquivamento para a tree view
            onArchive={(itemId, childrenCount) => {
              if (childrenCount > 0) {
                setArchiveConfirm({ itemId, childrenCount })
              } else {
                executeArchive(itemId)
              }
            }}
          />
        )}

        {view === 'kanban' && (
          <div className="p-3 sm:p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
              onDragOver={(e: DragOverEvent) => { if (e.over) lastOverRef.current = e.over.id.toString() }}
              onDragEnd={(e: DragEndEvent) => {
                const effectiveOver = e.over?.id?.toString() ?? lastOverRef.current ?? undefined
                lastOverRef.current = null
                 handleDragEnd(e, effectiveOver)
              }}
              onDragCancel={() => { lastOverRef.current = null; setActiveId(null) }}
            >
                {!isSimpleBoard && filters.moduleViewMode === 'tabs' && moduleGroups.length > 0 && (
                <div role="tablist" aria-label={tBoard('moduleViewTabs')} className="mb-3 flex gap-1.5 overflow-x-auto rounded-xl border border-border/80 bg-surface p-1">
                  {moduleGroups.map(({ module }) => (
                    <button
                      key={module.id}
                      type="button"
                      role="tab"
                      aria-selected={module.id === activeModuleId}
                      title={module.name}
                      onClick={() => setActiveModuleId(module.id)}
                      className={`flex-shrink-0 max-w-48 truncate rounded-lg px-3 py-2 text-xs font-semibold transition ${module.id === activeModuleId ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                      {module.name}
                    </button>
                  ))}
                </div>
              )}

                <BoardLanes
                  simpleBoard={isSimpleBoard}
                  simpleStory={simpleStory}
                  simpleCards={boardCards}
                  showStoryLanes={filters.storyDisplay === 'lanes'}
                  orphanCards={orphanCards}
                  moduleGroups={moduleGroups}
                  visibleModuleGroups={visibleModuleGroups}
                  columns={columns}
                  versions={projectVersions}
                  sprints={sprints}
                  collapsedEpics={collapsedEpics}
                  collapsedModules={collapsedModules}
                  collapsedStories={collapsedStories}
                  columnAddForms={columnAddForms}
                  onToggleEpic={toggleEpic}
                  onToggleModule={toggleModule}
                  onToggleStory={toggleStory}
                  onShowAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: true }))}
                  onHideAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: false }))}
                  onCardCreate={handleCardCreate}
                  onOpenDetail={handleOpenDetail}
                  onTitleSave={handleTitleSave}
                  onDelete={handleDeleteItem}
                  onArchive={handleArchiveRequest}
                  onEditStory={openStoryModal}
                  onEditEpic={epic => setEpicModalData({ epic: { id: epic.id, title: epic.title, moduleId: epic.moduleId ?? '', description: epic.description } })}
                  noModuleLabel={tBoard('noModule')}
                />

              <DragOverlay>
                {activeCard && (
                  <div className="rotate-2 scale-105">
                    <KanbanCard card={activeCard} />
                  </div>
                )}
                {isColumnDrag && activeId && (
                  <div className="opacity-80 bg-muted/30 rounded-xl border border-border p-3 w-72">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {columns.find(c => activeId.includes(c.id))?.name}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}
        </div>
      </div>

      <BoardModals
        projectId={projectId!}
        userId={user?.id}
        item={itemForModal}
        newItem={newItemCreation}
        story={storyModalData?.story}
        epic={epicModalData?.epic}
        moduleOpen={moduleModalOpen}
        moduleName={newModuleName}
        moduleDescription={newModuleDescription}
        archiveConfirm={archiveConfirm}
        archivedOpen={archivedModal}
        archivedItems={archivedItems}
        archivedLoading={archivedLoading}
        epics={epicsForModal}
        stories={storiesForSelector}
        modules={modules}
        tags={projectTags}
        members={members}
        versions={projectVersions}
        sprints={sprints}
        costCenters={projectCostCenters}
        onCloseItem={() => { setItemModalId(null); setNewItemCreation(null) }}
        onCloseStory={() => setStoryModalData(null)}
        onCloseEpic={() => setEpicModalData(null)}
        onCloseModule={() => setModuleModalOpen(false)}
        onCloseArchive={() => setArchiveConfirm(null)}
        onCloseArchived={() => setArchivedModal(false)}
        onCreate={handleModalCreate}
        onSaveItem={handleModalSave}
        onSaveStory={handleStorySave}
        onSaveEpic={handleEpicSave}
        onOpenChild={handleOpenChildFromHierarchy}
        onAddSubtask={handleAddSubtask}
        onCreateTag={handleCreateTag}
        onEditTag={handleEditTag}
        onCreateStory={handleCreateStory}
        onArchive={() => archiveConfirm && executeArchive(archiveConfirm.itemId)}
        onUnarchive={handleUnarchive}
        onModuleCreate={handleModuleCreate}
        onModuleNameChange={setNewModuleName}
        onModuleDescriptionChange={setNewModuleDescription}
        t={(key, options) => tBoard(key, options)}
      />
    </AppShell>
  )
}
