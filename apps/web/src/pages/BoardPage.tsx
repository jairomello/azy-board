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
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../lib/api'
import { onAssistantMutation } from '../lib/dataEvents'
import { useWebSocket } from '../hooks/useWebSocket'
import { formatDate } from '../lib/formatters'
import { KanbanCard, type CardData } from '../components/KanbanCard'
import { AddCardForm } from '../components/AddCardForm'
import { ItemModal, type FullItemData, type ProjectMember, type ProjectVersion, type CostCenter } from '../components/ItemModal'
import { EpicModal, type EpicData } from '../components/EpicModal'
import { StoryModal, type StoryData } from '../components/StoryModal'
import type { BoardFilterState } from '../components/BoardFilters'
import { ActiveFilterChips, removeActiveBoardFilter, type ActiveFilterKey } from '../components/ActiveFilterChips'
import { useToast } from '../components/Toast'
import { TreeViewPage, type TreeActionContext, type TreeCreationType } from './TreeViewPage'
import { useAuth } from '../contexts/AuthContext'
import { BookOpen, Plus, Pencil, Archive, X } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { BoardCommandBar } from '../components/BoardCommandBar'
import { ModuleSwimlane } from '../components/ModuleSwimlane'
import { BoardContextHeader, BoardStatusRail } from '../components/BoardContext'
import type { WsEvent, ItemType, AncestorNode, TaskStatus, BoardMode } from '@azy-board/types'
import type { Tag } from '../components/TagSelector'

// Mapa de status para nome legível (para a modal de itens arquivados)
const STATUS_LABEL: Partial<Record<TaskStatus, string>> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Bloqueada',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
}

// Item arquivado retornado por GET /projects/:id/tasks/archived
interface ArchivedItem {
  id: string
  type: ItemType
  title: string
  ancestryPath: string
  statusBeforeArchive: TaskStatus | null
  updatedAt: string
}

interface Column { id: string; name: string; baseStatus: string; position: number }
interface Module { id: string; name: string; position?: number }
interface Sprint { id: string; name: string; status: 'PROPOSED' | 'OPEN' | 'CLOSED' }
interface ProjectContext { name: string; boardMode?: BoardMode; simpleStoryId?: string | null }

// Tipo unificado: qualquer item retornado pela API
interface ItemData extends CardData {
  type: ItemType
  columnId: string | null
  parentId?: string | null
  moduleId?: string | null
  description?: string | null
  startDate?: string | null
  dueDate?: string | null
  assigneeId?: string | null
  position?: number
  authorId?: string | null
  versionId?: string | null
  itemSprints?: Array<{ sprintId: string }>
  // Campos de STORY
  persona?: string | null
  goal?: string | null
  benefit?: string | null
  acceptanceCriteria?: string | null
  notes?: string | null
}

interface StoryLaneGroup {
  id: string
  title: string
  story?: ItemData
  tasks: ItemData[]
}

// Extrai o id do EPIC ancestral a partir do ancestryPath
function getEpicIdFromPath(ancestryPath: string): string | null {
  try {
    const path: AncestorNode[] = JSON.parse(ancestryPath || '[]')
    return path.find(n => n.type === 'EPIC')?.id ?? null
  } catch { return null }
}

function getStoryIdFromPath(ancestryPath: string): string | null {
  try {
    const path: AncestorNode[] = JSON.parse(ancestryPath || '[]')
    return path.find(n => n.type === 'STORY')?.id ?? null
  } catch { return null }
}

// isLeaf: item sem filhos. Calculado client-side a partir do conjunto de parentIds
function computeIsLeaf(allItems: ItemData[]): ItemData[] {
  const parentIds = new Set(allItems.map(i => i.parentId).filter(Boolean) as string[])
  return allItems.map(i => ({ ...i, isLeaf: !parentIds.has(i.id) }))
}

function upsertItem(allItems: ItemData[], item: ItemData): ItemData[] {
  return computeIsLeaf([...allItems.filter(existing => existing.id !== item.id), item])
}

const DEFAULT_FILTERS: BoardFilterState = {
  moduleId: '',
  sprintId: '',
  assigneeId: '',
  squadId: '',
  types: [],
  tagIds: [],
  versionId: '',
  priority: '',
  status: '',
  authorId: '',
  costCenterId: '',
  hideEmptyEpics: false,
  hideEmptyStories: false,
  showSubtasks: false,
  storyDisplay: 'lanes',
  moduleViewMode: 'hierarchy',
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const { t: tBoard } = useTranslation('board')
  const { user } = useAuth()
  const { toast } = useToast()

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
  // Tarefa 9 — centros de custo do projeto
  const [projectCostCenters, setProjectCostCenters] = useState<CostCenter[]>([])
  const [projectSquads, setProjectSquads] = useState<{ id: string; name: string }[]>([])
  const [projectName, setProjectName] = useState('')
  const [boardMode, setBoardMode] = useState<BoardMode>('HIERARCHICAL')
  const [simpleStoryId, setSimpleStoryId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(() => {
    if (!projectId) return new Set()
    try {
      const raw = localStorage.getItem(`board-collapsed-epics:${projectId}`)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => {
    if (!projectId) return new Set()
    try {
      const raw = localStorage.getItem(`board-collapsed-modules:${projectId}`)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(() => {
    if (!projectId) return new Set()
    try {
      const raw = localStorage.getItem(`board-collapsed-stories:${projectId}`)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [view, setView] = useState<'kanban' | 'tree'>('kanban')
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() =>
    localStorage.getItem('board-density') === 'compact' ? 'compact' : 'comfortable'
  )
  const [loading, setLoading] = useState(true)
  const [itemModalId, setItemModalId] = useState<string | null>(null)
  const [storyModalData, setStoryModalData] = useState<{ story?: StoryData } | null>(null)
  const [epicModalData, setEpicModalData] = useState<{ epic?: EpicData } | null>(null)
  const [columnAddForms, setColumnAddForms] = useState<Record<string, boolean>>({})
  const [filters, setFilters] = useState<BoardFilterState>(() => {
    if (!projectId) return DEFAULT_FILTERS
    try {
      const raw = localStorage.getItem(`board-filters:${projectId}`)
      if (!raw) return DEFAULT_FILTERS
      const parsed = JSON.parse(raw) as Partial<BoardFilterState> & { showStories?: boolean }
      const { showStories: _legacyShowStories, ...currentFilters } = parsed
      return {
        ...DEFAULT_FILTERS,
        ...currentFilters,
        types: Array.isArray(currentFilters.types) ? currentFilters.types : [],
        tagIds: Array.isArray(currentFilters.tagIds) ? currentFilters.tagIds : [],
      }
    } catch {
      return DEFAULT_FILTERS
    }
  })
  const filtersProjectIdRef = useRef<string | null>(projectId ?? null)
  const [newItemCreation, setNewItemCreation] = useState<{ type: 'TASK' | 'BUG'; columnId?: string; title?: string; parentId?: string } | null>(null)
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
    if (!projectId || filtersProjectIdRef.current !== projectId) return
    try {
      localStorage.setItem(`board-filters:${projectId}`, JSON.stringify(filters))
    } catch {
      // localStorage indisponível (ex.: SecurityError em modo privativo restrito)
    }
  }, [filters, projectId])

  useEffect(() => {
    if (!projectId) {
      filtersProjectIdRef.current = null
      setFilters(DEFAULT_FILTERS)
      return
    }
    filtersProjectIdRef.current = null
    let nextFilters = DEFAULT_FILTERS
    try {
      const raw = localStorage.getItem(`board-filters:${projectId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BoardFilterState> & { showStories?: boolean }
        const { showStories: _legacyShowStories, ...currentFilters } = parsed
        nextFilters = {
          ...DEFAULT_FILTERS,
          ...currentFilters,
          types: Array.isArray(currentFilters.types) ? currentFilters.types : [],
          tagIds: Array.isArray(currentFilters.tagIds) ? currentFilters.tagIds : [],
        }
      }
    } catch {
      nextFilters = DEFAULT_FILTERS
    }
    setFilters(nextFilters)
    filtersProjectIdRef.current = projectId
  }, [projectId])

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

  useEffect(() => {
    if (!projectId) return
    try {
      localStorage.setItem(`board-collapsed-epics:${projectId}`, JSON.stringify([...collapsedEpics]))
    } catch {}
  }, [collapsedEpics, projectId])

  useEffect(() => {
    if (!projectId) return
    try {
      localStorage.setItem(`board-collapsed-modules:${projectId}`, JSON.stringify([...collapsedModules]))
    } catch {}
  }, [collapsedModules, projectId])

  useEffect(() => {
    if (!projectId) return
    try {
      localStorage.setItem(`board-collapsed-stories:${projectId}`, JSON.stringify([...collapsedStories]))
    } catch {}
  }, [collapsedStories, projectId])

  useEffect(() => {
    localStorage.setItem('board-density', density)
  }, [density])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Prioriza elementos menores (cards) sobre elementos maiores (colunas) na detecção de colisão
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args)
    if (hits.length > 0) return hits
    return rectIntersection(args)
  }, [])

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
      // Tarefa 9 — carregar centros de custo junto com os demais dados
      api.get<CostCenter[]>(`/projects/${projectId}/cost-centers`).catch(() => [] as CostCenter[]),
      api.get<{ id: string; name: string }[]>(`/projects/${projectId}/squads`).catch(() => []),
       api.get<ProjectContext>(`/projects/${projectId}`).catch(() => ({ name: '', boardMode: 'HIERARCHICAL' as const, simpleStoryId: null })),
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
    }).finally(() => setLoading(false))
   }, [assistantRefresh, projectId])

  // WebSocket: atualizações em tempo real
  const syncState = useWebSocket(projectId ?? null, {
    CARD_MOVED: (e: WsEvent) => {
      const { itemId, columnId, status } = e.payload as { itemId: string; columnId: string; status: string }
      setAllItems(prev => prev.map(i => i.id === itemId ? { ...i, columnId, status: status as ItemData['status'] } : i))
    },
    ITEM_CREATED: (e: WsEvent) => {
      const item = e.payload as ItemData
      setAllItems(prev => upsertItem(prev, item))
    },
    MODULE_CREATED: (e: WsEvent) => {
      const module = e.payload as Module
      setModules(prev => prev.some(item => item.id === module.id) ? prev : [...prev, module])
    },
    ITEM_UPDATED: (e: WsEvent) => {
      const { itemId, ...updates } = e.payload as { itemId: string; [k: string]: unknown }
      // [isLeaf] parentId pode ter mudado → recalcular folhas
      setAllItems(prev => computeIsLeaf(prev.map(i => i.id === itemId ? { ...i, ...updates } : i)))
    },
    ITEM_DELETED: (e: WsEvent) => {
      const { itemId } = e.payload as { itemId: string }
      setAllItems(prev => computeIsLeaf(prev.filter(i => i.id !== itemId)))
    },
    // Manter compatibilidade com eventos antigos
    CARD_CREATED: (e: WsEvent) => {
      const item = e.payload as ItemData
      setAllItems(prev => upsertItem(prev, item))
    },
    CARD_UPDATED: (e: WsEvent) => {
      const { taskId, itemId, ...updates } = e.payload as { taskId?: string; itemId?: string; [k: string]: unknown }
      const id = itemId ?? taskId
      if (id) setAllItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    },
    CARD_DELETED: (e: WsEvent) => {
      const { itemId, taskId } = e.payload as { itemId?: string; taskId?: string }
      const id = itemId ?? taskId
      if (id) setAllItems(prev => computeIsLeaf(prev.filter(i => i.id !== id)))
    },
    TASK_CLAIMED: (e: WsEvent) => {
      const { itemId, taskId, assigneeId } = e.payload as { itemId?: string; taskId?: string; assigneeId: string }
      const id = itemId ?? taskId
      if (id) setAllItems(prev => prev.map(i => i.id === id ? { ...i, assigneeId, status: 'IN_PROGRESS' } : i))
    },
    SUBTASK_CREATED: (e: WsEvent) => {
      // [isLeaf] inclui parentId para que computeIsLeaf marque o pai como não-folha
      const { parentId: newParentId, item, task } = e.payload as { parentId: string; item?: ItemData; task?: ItemData }
      const newItem = item ?? task
      if (newItem) setAllItems(prev => upsertItem(prev, { ...newItem, parentId: newParentId }))
    },
    CHECKLIST_UPDATED: (e: WsEvent) => {
      const { itemId, progress } = e.payload as { itemId: string; progress: { checked: number; total: number } }
      setAllItems(prev => prev.map(i => i.id === itemId
        ? { ...i, checklistProgress: progress.total > 0 ? progress : null }
        : i
      ))
    },
  })

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

  function toggleEpic(epicId: string) {
    setCollapsedEpics(prev => {
      const next = new Set(prev)
      next.has(epicId) ? next.delete(epicId) : next.add(epicId)
      return next
    })
  }

  function toggleModule(moduleId: string) {
    setCollapsedModules(prev => {
      const next = new Set(prev)
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId)
      return next
    })
  }

  function toggleStory(storyId: string) {
    setCollapsedStories(prev => {
      const next = new Set(prev)
      next.has(storyId) ? next.delete(storyId) : next.add(storyId)
      return next
    })
  }

  async function handleDragEnd(event: DragEndEvent, effectiveOverStr?: string) {
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
      await api.post(`/projects/${projectId}/items`, {
        title,
        columnId,
        priority: 'MEDIUM',
        type,
        ...(versionId ? { versionId } : {}),
        ...(sprintId ? { sprintId } : {}),
        ...(parentId ? { parentId } : {}),
      })
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
      })
      setAllItems(prev => prev.map(i => i.id === data.id ? { ...i, ...data } : i))
    } else {
      const item = await api.post<ItemData>(`/projects/${projectId}/items`, {
        type: 'EPIC',
        moduleId: data.moduleId,
        title: data.title,
        description: data.description,
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
      const item = allItems.find(i => i.id === id)
      if (item?.type === 'STORY') {
        openStoryModal(item)
      } else {
        setItemModalId(id)
      }
    }
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
        parentId: context.parentId,
        title: type === 'TASK' ? 'Nova Task' : 'Novo Bug',
      })
    }
  }

  const visibleModuleGroups = filters.moduleViewMode === 'tabs'
    ? moduleGroups.filter(group => group.module.id === activeModuleId)
    : moduleGroups

  function renderModuleGroup({ module, epics: groupedEpics }: typeof moduleGroups[number]) {
    const moduleItems = allItems.filter(item => groupedEpics.some(group => getEpicIdFromPath(item.ancestryPath) === group.epic.id))
    const moduleLeaves = moduleItems.filter(item => item.isLeaf && ['TASK', 'BUG'].includes(item.type))
    const moduleDone = moduleLeaves.filter(item => item.status === 'DONE').length
    const moduleProgress = moduleLeaves.length > 0 ? Math.round((moduleDone / moduleLeaves.length) * 100) : 0
    const modulePoints = moduleLeaves.reduce((sum, item) => sum + (item.points ?? 0), 0)

    return (
      <ModuleSwimlane
        key={module.id}
        title={module.name}
        epicCount={groupedEpics.length}
        progress={moduleProgress}
        points={modulePoints}
        collapsed={collapsedModules.has(module.id)}
        onToggle={() => toggleModule(module.id)}
      >
        {groupedEpics.map(({ epic, tasks: epicTasks, storyGroups }) => (
          <Swimlane
            key={epic.id}
            swimlaneId={epic.id}
            title={epic.title}
            columns={columns}
            versions={projectVersions}
            sprints={sprints}
            tasks={epicTasks}
            collapsed={collapsedEpics.has(epic.id)}
            onToggle={() => toggleEpic(epic.id)}
            columnAddForms={columnAddForms}
            onShowAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: true }))}
            onHideAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: false }))}
            onCardCreate={handleCardCreate}
            onOpenDetail={handleOpenDetail}
            onTitleSave={handleTitleSave}
            onDelete={handleDeleteItem}
            onArchive={handleArchiveRequest}
            storyGroups={filters.storyDisplay === 'lanes' ? storyGroups : undefined}
            defaultParentId={storyGroups.find(group => group.story)?.story?.id ?? null}
            collapsedStories={collapsedStories}
            onToggleStory={toggleStory}
            onEditStory={story => openStoryModal(story)}
            onEditEpic={() => setEpicModalData({ epic: { id: epic.id, title: epic.title, moduleId: epic.moduleId ?? '', description: epic.description } })}
          />
        ))}
      </ModuleSwimlane>
    )
  }

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
      projectId={projectId}
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
             projectId={projectId}
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
               {/* Swimlane única do modo simples */}
               {isSimpleBoard && simpleStory && (
                 <Swimlane
                   swimlaneId={simpleStory.id}
                   title={simpleStory.title}
                    columns={columns}
                    versions={projectVersions}
                    sprints={sprints}
                    tasks={boardCards}
                   collapsed={false}
                   onToggle={() => {}}
                   columnAddForms={columnAddForms}
                   onShowAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: true }))}
                   onHideAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: false }))}
                   onCardCreate={handleCardCreate}
                   onOpenDetail={handleOpenDetail}
                   onTitleSave={handleTitleSave}
                   onDelete={handleDeleteItem}
                   onArchive={handleArchiveRequest}
                   onEditEpic={null}
                 />
               )}

               {/* Swimlane itens órfãos */}
               {!isSimpleBoard && orphanCards.length > 0 && (
                 <Swimlane
                   swimlaneId="orphan"
                    title={tBoard('noModule')}
                   allowAdd={false}
                    columns={columns}
                   versions={projectVersions}
                   sprints={sprints}
                   tasks={orphanCards}
                  collapsed={collapsedEpics.has('orphan')}
                  onToggle={() => toggleEpic('orphan')}
                  columnAddForms={columnAddForms}
                  onShowAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: true }))}
                  onHideAddForm={colId => setColumnAddForms(prev => ({ ...prev, [colId]: false }))}
                  onCardCreate={handleCardCreate}
                  onOpenDetail={handleOpenDetail}
                  onTitleSave={handleTitleSave}
                  onDelete={handleDeleteItem}
                  onArchive={handleArchiveRequest}
                  onEditEpic={null}
                />
              )}

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

               {!isSimpleBoard && visibleModuleGroups.map(renderModuleGroup)}

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

      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModuleModalOpen(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
             <h2 className="text-lg font-semibold text-foreground">{tBoard('newModule')}</h2>
            <div>
               <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="module-name">{tBoard('moduleLabel')}</label>
               <input id="module-name" autoFocus value={newModuleName} onChange={event => setNewModuleName(event.target.value)} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary" placeholder={tBoard('moduleNamePlaceholder')} />
            </div>
            <div>
               <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="module-description">{tBoard('descriptionLabel')}</label>
               <textarea id="module-description" value={newModuleDescription} onChange={event => setNewModuleDescription(event.target.value)} rows={3} className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary resize-none" placeholder={tBoard('moduleDescriptionPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-2">
               <button onClick={handleModuleCreate} disabled={!newModuleName.trim()} className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">{tBoard('create')}</button>
               <button onClick={() => setModuleModalOpen(false)} className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-muted text-muted-foreground">{tBoard('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de item (TASK/BUG) */}
      {itemForModal && projectId && (
        <ItemModal
          item={itemForModal as FullItemData}
          projectId={projectId}
          epics={epicsForModal}
          stories={storiesForSelector}
          projectTags={projectTags}
          members={members}
          currentUserId={user?.id}
          projectVersions={projectVersions}
          projectSprints={sprints}
          projectCostCenters={projectCostCenters}
          onClose={() => setItemModalId(null)}
          onSave={handleModalSave}
          onAddSubtask={handleAddSubtask}
          onCreateTag={handleCreateTag}
          onEditTag={handleEditTag}
          onCreateStory={handleCreateStory}
        />
      )}

      {/* Modal de épico */}
      {epicModalData && (
        <EpicModal
          modules={modules}
          epic={epicModalData.epic}
          projectVersions={projectVersions}
          onSave={handleEpicSave}
          onClose={() => setEpicModalData(null)}
        />
      )}

      {/* Modal de história */}
      {storyModalData !== null && (
        <StoryModal
          epics={epicsForModal}
          story={storyModalData.story}
          projectVersions={projectVersions}
          onSave={handleStorySave}
          onClose={() => setStoryModalData(null)}
        />
      )}

      {/* Tarefa 10.1 — Dialog de confirmação de arquivamento (quando item tem filhos) */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setArchiveConfirm(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
             <h3 className="font-semibold text-foreground mb-2">{tBoard('archiveItem')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
               {tBoard('archiveCascadeConfirmation', { count: archiveConfirm.childrenCount })}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
              >
                 {tBoard('cancel')}
              </button>
              <button
                onClick={() => executeArchive(archiveConfirm.itemId)}
                className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
              >
                 {tBoard('archiveItem')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarefa 10.5 — Modal "Itens Arquivados" */}
      {archivedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setArchivedModal(false)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Archive className="w-4 h-4 text-muted-foreground" />
                 {tBoard('archivedItems')}
              </h3>
              <button onClick={() => setArchivedModal(false)} className="text-muted-foreground hover:text-foreground transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {archivedLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full" />
                </div>
              )}
              {/* Tarefa 10.7 — estado vazio */}
              {!archivedLoading && archivedItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Archive className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum item arquivado neste projeto.</p>
                </div>
              )}
              {!archivedLoading && archivedItems.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="pb-2 text-left font-medium">Tipo</th>
                       <th className="pb-2 text-left font-medium">{tBoard('title')}</th>
                      <th className="pb-2 text-left font-medium">Coluna original</th>
                      <th className="pb-2 text-left font-medium">Data</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {archivedItems.map(item => {
                      let ancestorEpicTitle = ''
                      try {
                        const path: AncestorNode[] = JSON.parse(item.ancestryPath || '[]')
                        ancestorEpicTitle = path.find(n => n.type === 'EPIC')?.title ?? ''
                      } catch { /* noop */ }
                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              item.type === 'BUG' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                              item.type === 'TASK' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                              item.type === 'STORY' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' :
                              'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-foreground line-clamp-1">{item.title}</p>
                            {ancestorEpicTitle && (
                              <p className="text-xs text-muted-foreground truncate">{ancestorEpicTitle}</p>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground text-xs">
                            {item.statusBeforeArchive ? (STATUS_LABEL[item.statusBeforeArchive] ?? item.statusBeforeArchive) : '—'}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground text-xs whitespace-nowrap">
                             {formatDate(item.updatedAt)}
                          </td>
                          <td className="py-2.5 text-right">
                            {/* Tarefa 10.6 — botão Restaurar */}
                            <button
                              onClick={() => handleUnarchive(item.id)}
                              className="text-xs text-primary hover:underline font-medium px-2 py-1 rounded hover:bg-primary/10 transition"
                            >
                               {tBoard('back')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de criação de TASK/BUG via toolbar */}
      {newItemCreation && projectId && (
        <ItemModal
          item={{
            id: '__new__',
            title: newItemCreation.title ?? '',
            status: 'NOT_STARTED',
            priority: 'MEDIUM',
            type: newItemCreation.type,
            points: null,
            description: null,
            startDate: null,
            dueDate: null,
             parentId: newItemCreation.parentId ?? null,
            assigneeId: null,
            assignee: null,
            itemTags: [],
            taskTags: [],
            isLeaf: true,
            ancestryPath: '[]',
            // Tarefa 9.2 — pré-seleciona o primeiro centro de custo (igual ao que o backend atribui)
            costCenterId: projectCostCenters[0]?.id ?? null,
            itemSprints: [],
          }}
          projectId={projectId}
          epics={epicsForModal}
          stories={storiesForSelector}
          projectTags={projectTags}
          members={members}
          currentUserId={user?.id}
          projectVersions={projectVersions}
          projectSprints={sprints}
          projectCostCenters={projectCostCenters}
          onClose={() => setNewItemCreation(null)}
          onSave={handleModalCreate}
          onAddSubtask={handleAddSubtask}
          onCreateTag={handleCreateTag}
          onEditTag={handleEditTag}
          onCreateStory={handleCreateStory}
        />
      )}
    </AppShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────

interface SwimlaneProps {
  swimlaneId: string
  title: string
  columns: Column[]
  versions: ProjectVersion[]
  sprints: Sprint[]
  tasks: ItemData[]
  collapsed: boolean
  onToggle: () => void
  columnAddForms: Record<string, boolean>
  onShowAddForm: (colId: string) => void
  onHideAddForm: (colId: string) => void
  onCardCreate: (
    colId: string,
    title: string,
    type: ItemType,
    parentId?: string,
    formKey?: string,
    versionId?: string,
    sprintId?: string,
  ) => Promise<void>
  onOpenDetail: (id: string) => void
  onTitleSave: (id: string, title: string) => void
  onDelete?: (id: string) => void
  // Tarefa 10.1 — callback de arquivamento passado para os KanbanCards
  onArchive?: (id: string) => void
  onEditEpic: (() => void) | null
  storyGroups?: StoryLaneGroup[]
  collapsedStories?: Set<string>
  onToggleStory?: (storyId: string) => void
  defaultParentId?: string | null
  allowAdd?: boolean
  onEditStory?: (story: ItemData) => void
}

function Swimlane({
  swimlaneId,
  title,
  columns,
  versions,
  sprints,
  tasks,
  collapsed,
  onToggle,
  columnAddForms,
  onShowAddForm,
  onHideAddForm,
  onCardCreate,
  onOpenDetail,
  onTitleSave,
  onDelete,
  onArchive,
  onEditEpic,
  storyGroups,
  collapsedStories,
  onToggleStory,
  onEditStory,
  defaultParentId,
  allowAdd,
}: SwimlaneProps) {
  const { t: tBoard } = useTranslation('board')
  const doneCount = tasks.filter(task => task.status === 'DONE').length
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <section className="mb-4 rounded-xl border border-border/80 bg-surface p-2.5 sm:p-3 shadow-sm">
      <div className="flex items-center gap-3 w-full mb-3 px-1">
        <button
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex items-center gap-2.5 flex-1 text-left group min-w-0"
        >
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="min-w-0">
            <span className="font-semibold text-sm text-foreground block truncate">{title}</span>
            <span className="text-[11px] text-muted-foreground">
              {storyGroups
                ? `${storyGroups.length} ${storyGroups.length === 1 ? 'história' : 'histórias'} · ${tasks.length} ${tasks.length === 1 ? 'card' : 'cards'}`
                : `${tasks.length} ${tasks.length === 1 ? 'item' : 'itens'}`}
            </span>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 w-36">
            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-status-done rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{progress}%</span>
          </div>
        </button>
        {onEditEpic && (
          <button
            onClick={onEditEpic}
            className="text-muted-foreground hover:text-foreground transition flex-shrink-0 p-1 rounded hover:bg-muted"
             title={tBoard('editEpic')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!collapsed && storyGroups && (
        <div className="ml-2 sm:ml-4 pl-3 sm:pl-5 border-l-2 border-violet-400/30 space-y-2.5">
          {storyGroups.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
               {tBoard('noStoriesInEpic')}
            </div>
          )}
          {storyGroups.map(group => (
            <StorySwimlane
              key={group.id}
              group={group}
              columns={columns}
              versions={versions}
              sprints={sprints}
              collapsed={collapsedStories?.has(group.id) ?? false}
              onToggle={() => onToggleStory?.(group.id)}
              columnAddForms={columnAddForms}
              onShowAddForm={onShowAddForm}
              onHideAddForm={onHideAddForm}
              onCardCreate={onCardCreate}
              onOpenDetail={onOpenDetail}
              onTitleSave={onTitleSave}
              onDelete={onDelete}
              onArchive={onArchive}
              onEdit={group.story && onEditStory ? () => onEditStory(group.story!) : undefined}
            />
          ))}
        </div>
      )}

      {!collapsed && !storyGroups && (
        <BoardColumns
          laneId={swimlaneId}
              columns={columns}
              versions={versions}
              sprints={sprints}
              tasks={tasks}
          parentId={defaultParentId ?? undefined}
          allowAdd={allowAdd ?? true}
          columnAddForms={columnAddForms}
          onShowAddForm={onShowAddForm}
          onHideAddForm={onHideAddForm}
          onCardCreate={onCardCreate}
          onOpenDetail={onOpenDetail}
          onTitleSave={onTitleSave}
          onDelete={onDelete}
          onArchive={onArchive}
        />
      )}
    </section>
  )
}

interface StorySwimlaneProps {
  group: StoryLaneGroup
  columns: Column[]
  versions: ProjectVersion[]
  sprints: Sprint[]
  collapsed: boolean
  onToggle: () => void
  columnAddForms: Record<string, boolean>
  onShowAddForm: (formKey: string) => void
  onHideAddForm: (formKey: string) => void
  onCardCreate: SwimlaneProps['onCardCreate']
  onOpenDetail: (id: string) => void
  onTitleSave: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onArchive?: (id: string) => void
  onEdit?: () => void
}

function StorySwimlane({
  group,
  columns,
  versions,
  sprints,
  collapsed,
  onToggle,
  columnAddForms,
  onShowAddForm,
  onHideAddForm,
  onCardCreate,
  onOpenDetail,
  onTitleSave,
  onDelete,
  onArchive,
  onEdit,
}: StorySwimlaneProps) {
  const { t: tBoard } = useTranslation('board')
  const doneCount = group.tasks.filter(task => task.status === 'DONE').length
  const progress = group.tasks.length > 0 ? Math.round((doneCount / group.tasks.length) * 100) : 0

  return (
    <section className="relative rounded-lg border border-violet-300/50 dark:border-violet-500/25 bg-surface-raised overflow-hidden">
      <span className="absolute -left-[22px] sm:-left-[30px] top-6 w-4 sm:w-6 h-px bg-violet-400/40" aria-hidden />
      <div className={`flex items-center gap-2.5 px-3 py-2.5 ${collapsed ? '' : 'border-b border-border/70'} bg-violet-500/[0.045]`}>
        <button
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="min-w-0 flex-1 flex items-center gap-2.5 text-left"
        >
          <svg
            className={`w-3.5 h-3.5 text-violet-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="w-7 h-7 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.12em] font-semibold text-violet-600 dark:text-violet-300">
              {group.story ? 'História' : 'Agrupamento'}
            </span>
            <span className="block text-sm font-semibold text-foreground truncate">{group.title}</span>
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
            {group.tasks.length} {group.tasks.length === 1 ? 'card' : 'cards'}
          </span>
          <span className="hidden sm:flex items-center gap-2 w-28">
            <span className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
              <span className="block h-full bg-status-done rounded-full" style={{ width: `${progress}%` }} />
            </span>
            <span className="text-[10px] tabular-nums font-semibold text-muted-foreground">{progress}%</span>
          </span>
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
             title={tBoard('editStory')}
             aria-label={`${tBoard('editStory')} ${group.title}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="p-2.5">
          <BoardColumns
            laneId={`story-${group.id}`}
            columns={columns}
            versions={versions}
            sprints={sprints}
            tasks={group.tasks}
            parentId={group.story?.id}
            columnAddForms={columnAddForms}
            onShowAddForm={onShowAddForm}
            onHideAddForm={onHideAddForm}
            onCardCreate={onCardCreate}
            onOpenDetail={onOpenDetail}
            onTitleSave={onTitleSave}
            onDelete={onDelete}
            onArchive={onArchive}
          />
        </div>
      )}
    </section>
  )
}

interface BoardColumnsProps {
  laneId: string
  columns: Column[]
  versions: ProjectVersion[]
  sprints: Sprint[]
  tasks: ItemData[]
  parentId?: string
  allowAdd?: boolean
  columnAddForms: Record<string, boolean>
  onShowAddForm: (formKey: string) => void
  onHideAddForm: (formKey: string) => void
  onCardCreate: SwimlaneProps['onCardCreate']
  onOpenDetail: (id: string) => void
  onTitleSave: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onArchive?: (id: string) => void
}

function BoardColumns({
  laneId,
  columns,
  versions,
  sprints,
  tasks,
  parentId,
  allowAdd = true,
  columnAddForms,
  onShowAddForm,
  onHideAddForm,
  onCardCreate,
  onOpenDetail,
  onTitleSave,
  onDelete,
  onArchive,
}: BoardColumnsProps) {
  const columnSortableIds = columns.map(column => `${laneId}:col:${column.id}`)

  return (
    <SortableContext id={`cols-${laneId}`} items={columnSortableIds} strategy={horizontalListSortingStrategy}>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
        {columns.map(column => {
          const columnTasks = tasks.filter(task => task.columnId === column.id)
          const sortableId = `${laneId}:col:${column.id}`
          const formKey = `${laneId}:${column.id}`
          return (
            <SortableColumn
              key={column.id}
              id={sortableId}
              colName={column.name}
              colCount={columnTasks.length}
              baseStatus={column.baseStatus}
            >
              <DroppableColumn droppableId={`${laneId}:drop:${column.id}`}>
                <div className="flex-1 px-3 pt-2.5 space-y-2">
                  <SortableContext
                    id={`${laneId}-cards-${column.id}`}
                    items={columnTasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {columnTasks.map(task => (
                      <KanbanCard
                        key={task.id}
                        card={task}
                        onOpenDetail={onOpenDetail}
                        onTitleSave={onTitleSave}
                        onDelete={onDelete}
                        onArchive={onArchive}
                      />
                    ))}
                  </SortableContext>
                </div>
                <div className="p-2 mt-1">
                  {allowAdd && (columnAddForms[formKey] ? (
                    <AddCardForm
                        versions={versions}
                        sprints={sprints}
                        onAdd={(title, type, versionId, sprintId) => onCardCreate(column.id, title, type, parentId, formKey, versionId, sprintId)}
                      onCancel={() => onHideAddForm(formKey)}
                    />
                  ) : (
                    <button
                      onClick={() => onShowAddForm(formKey)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar card
                    </button>
                  ))}
                </div>
              </DroppableColumn>
            </SortableColumn>
          )
        })}
      </div>
    </SortableContext>
  )
}

function SortableColumn({ id, colName, colCount, baseStatus, children }: {
  id: string
  colName: string
  colCount: number
  baseStatus: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const statusColor = baseStatus === 'DONE'
    ? 'bg-status-done'
    : baseStatus === 'BLOCKED'
      ? 'bg-status-blocked'
      : baseStatus === 'IN_PROGRESS'
        ? 'bg-status-progress'
        : 'bg-slate-400'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined }}
      className="flex-shrink-0 w-[292px] bg-surface-raised border border-border/80 rounded-lg flex flex-col overflow-hidden"
    >
      <div className="px-3 py-2.5 cursor-grab active:cursor-grabbing select-none border-b border-border/70 bg-surface" {...attributes} {...listeners}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" fill="currentColor" viewBox="0 0 8 16">
              <circle cx="2" cy="2" r="1.5" /><circle cx="6" cy="2" r="1.5" />
              <circle cx="2" cy="8" r="1.5" /><circle cx="6" cy="8" r="1.5" />
              <circle cx="2" cy="14" r="1.5" /><circle cx="6" cy="14" r="1.5" />
            </svg>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-[0.08em]">{colName}</span>
          </div>
          <span className="min-w-5 h-5 px-1 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground inline-flex items-center justify-center">{colCount}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

function DroppableColumn({ droppableId, children }: { droppableId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col min-h-24 transition-colors ${isOver ? 'bg-primary/10' : ''}`}
    >
      {children}
    </div>
  )
}
