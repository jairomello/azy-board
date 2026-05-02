import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
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
import { useWebSocket } from '../hooks/useWebSocket'
import { KanbanCard, type CardData } from '../components/KanbanCard'
import { ProfileDropdown } from '../components/ProfileDropdown'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageSelector } from '../components/LanguageSelector'
import { AddCardForm } from '../components/AddCardForm'
import { ItemModal, type FullItemData, type ProjectMember, type ProjectVersion, type CostCenter } from '../components/ItemModal'
import { EpicModal, type EpicData } from '../components/EpicModal'
import { StoryModal, type StoryData } from '../components/StoryModal'
import { BoardFilters, type BoardFilterState } from '../components/BoardFilters'
import { useToast } from '../components/Toast'
import { TreeViewPage } from './TreeViewPage'
import { useAuth } from '../contexts/AuthContext'
import { Layers, BookOpen, CheckSquare, Bug, Plus, Pencil, Archive, X } from 'lucide-react'
import { Tooltip } from '../components/ui/Tooltip'
import type { WsEvent, ItemType, AncestorNode, TaskStatus } from '@azy-board/types'
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
interface Module { id: string; name: string }
interface Sprint { id: string; name: string; status: string }

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
  // Campos de STORY
  persona?: string | null
  goal?: string | null
  benefit?: string | null
  acceptanceCriteria?: string | null
  notes?: string | null
}

// Extrai o id do EPIC ancestral a partir do ancestryPath
function getEpicIdFromPath(ancestryPath: string): string | null {
  try {
    const path: AncestorNode[] = JSON.parse(ancestryPath || '[]')
    return path.find(n => n.type === 'EPIC')?.id ?? null
  } catch { return null }
}

// isLeaf: item sem filhos. Calculado client-side a partir do conjunto de parentIds
function computeIsLeaf(allItems: ItemData[]): ItemData[] {
  const parentIds = new Set(allItems.map(i => i.parentId).filter(Boolean) as string[])
  return allItems.map(i => ({ ...i, isLeaf: !parentIds.has(i.id) }))
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const { toast } = useToast()

  const [columns, setColumns] = useState<Column[]>([])
  const [allItems, setAllItems] = useState<ItemData[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [projectTags, setProjectTags] = useState<Tag[]>([])
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([])
  // Tarefa 9 — centros de custo do projeto
  const [projectCostCenters, setProjectCostCenters] = useState<CostCenter[]>([])
  const [projectSquads, setProjectSquads] = useState<{ id: string; name: string }[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'kanban' | 'tree'>('kanban')
  const [showSubtasks, setShowSubtasks] = useState(false)
  const [showStories, setShowStories] = useState(false)
  const [loading, setLoading] = useState(true)
  const [itemModalId, setItemModalId] = useState<string | null>(null)
  const [storyModalData, setStoryModalData] = useState<{ story?: StoryData } | null>(null)
  const [epicModalData, setEpicModalData] = useState<{ epic?: EpicData } | null>(null)
  const [columnAddForms, setColumnAddForms] = useState<Record<string, boolean>>({})
  const [filters, setFilters] = useState<BoardFilterState>({
    moduleId: '', sprintId: '', assigneeId: '', squadId: '', types: [], tagIds: [], hideEmptyEpics: false,
  })
  const [newItemCreation, setNewItemCreation] = useState<{ type: 'TASK' | 'BUG'; columnId?: string; title?: string } | null>(null)
  // Tarefa 10 — arquivamento
  const [archiveConfirm, setArchiveConfirm] = useState<{ itemId: string; childrenCount: number } | null>(null)
  const [archivedModal, setArchivedModal] = useState(false)
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)

  // Ref para preservar o over ID mais recente durante o drag (evita perder o alvo no momento do drop)
  const lastOverRef = useRef<string | null>(null)

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
    ]).then(([cols, its, mods, tags, sprs, mbrs, vers, ccs, sqs]) => {
      setColumns(cols)
      setAllItems(computeIsLeaf(its))
      setModules(mods)
      setProjectTags(tags)
      setSprints(sprs)
      setMembers(mbrs)
      setProjectVersions(vers)
      setProjectCostCenters(ccs)
      setProjectSquads(sqs)
    }).finally(() => setLoading(false))
  }, [projectId])

  // WebSocket: atualizações em tempo real
  useWebSocket(projectId ?? null, {
    CARD_MOVED: (e: WsEvent) => {
      const { itemId, columnId, status } = e.payload as { itemId: string; columnId: string; status: string }
      setAllItems(prev => prev.map(i => i.id === itemId ? { ...i, columnId, status: status as ItemData['status'] } : i))
    },
    ITEM_CREATED: (e: WsEvent) => {
      const item = e.payload as ItemData
      setAllItems(prev => computeIsLeaf([...prev, { ...item }]))
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
      setAllItems(prev => computeIsLeaf([...prev, { ...item }]))
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
      if (newItem) setAllItems(prev => computeIsLeaf([...prev, { ...newItem, parentId: newParentId }]))
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

  // IDs das STORYs — usados para identificar TASK/BUG de primeiro nível
  const storyIdSet = useMemo(() => new Set(stories.map(s => s.id)), [stories])

  // Cards para o board
  //   showSubtasks = false ("Mostrar subtasks"): mostra TASK/BUG de primeiro nível
  //     = cujo parentId aponta para uma STORY, ou sem parentId (órfãos)
  //   showSubtasks = true  ("Ocultar subtasks"): Leaf Rule
  //     = só TASK/BUG sem filhos (subtasks ficam visíveis, pais somem)
  const boardCards = useMemo(() => {
    let result: ItemData[]
    if (showSubtasks) {
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
    return result
  }, [allItems, showSubtasks, storyIdSet, filters, epics, squadMembersMap])

  // Cards virtuais de histórias quando toggle "Mostrar histórias" ativo
  const storyVirtualCards: ItemData[] = useMemo(() => {
    if (!showStories || columns.length === 0) return []
    const firstColId = columns[0]!.id
    return stories.map(s => ({
      ...s,
      id: `story-virtual-${s.id}`,
      columnId: firstColId,
      isLeaf: false,
    }))
  }, [showStories, stories, columns])

  const allDisplayed = useMemo(() => [...boardCards, ...storyVirtualCards], [boardCards, storyVirtualCards])

  // Agrupar por EPIC via ancestryPath.
  // Story-virtual cards têm ancestryPath da story original (contém o EPIC),
  // então getEpicIdFromPath funciona para eles também.
  // quando hideEmptyEpics ativo ou squad selecionado, oculta épicos sem descendants visíveis
  const epicGroups = useMemo(() => {
    const hideEmpty = filters.hideEmptyEpics || !!filters.squadId
    return epics
      .map(epic => {
        const epicCards = allDisplayed.filter(i =>
          getEpicIdFromPath(i.ancestryPath) === epic.id
        )
        return { epic, tasks: epicCards }
      })
      .filter(group => !hideEmpty || group.tasks.length > 0)
  }, [epics, allDisplayed, filters.hideEmptyEpics, filters.squadId])

  const orphanCards = useMemo(() =>
    allDisplayed.filter(i => !getEpicIdFromPath(i.ancestryPath) && !i.id.startsWith('story-virtual-')),
    [allDisplayed]
  )

  function toggleEpic(epicId: string) {
    setCollapsedEpics(prev => {
      const next = new Set(prev)
      next.has(epicId) ? next.delete(epicId) : next.add(epicId)
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
      const overColId = overStr.includes(':col:') ? overStr.split(':col:')[1]! : null
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
    if (!item || !item.isLeaf || ['EPIC', 'STORY'].includes(item.type)) return

    const colIds = new Set(columns.map(c => c.id))
    let targetColId: string | undefined

    if (colIds.has(overStr)) {
      targetColId = overStr
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
    setAllItems(prev => computeIsLeaf([...prev, created]))
    if (tagIds.length > 0) {
      await api.post(`/projects/${projectId}/items/${created.id}/tags`, { tagIds })
    }
  }, [projectId, newItemCreation, columns])

  const handleCardCreate = useCallback(async (columnId: string, title: string, type: ItemType) => {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items`, { title, columnId, priority: 'MEDIUM', type })
      setColumnAddForms(prev => ({ ...prev, [columnId]: false }))
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
    } catch {
      toast('Erro ao salvar item', 'error')
      throw new Error('failed')
    }
  }, [projectId, toast])

  const handleAddSubtask = useCallback(async (parentId: string, title: string, type: ItemType) => {
    if (!projectId) return
    try {
      await api.post(`/projects/${projectId}/items`, { title, parentId, type })
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
      setAllItems(prev => computeIsLeaf([...prev, item]))
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
    setAllItems(prev => computeIsLeaf([...prev, item]))
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
      setAllItems(prev => computeIsLeaf([...prev, item]))
    }
  }, [projectId])

  const isColumnDrag = activeId?.includes(':col:') ?? false
  const activeCard = !isColumnDrag ? allItems.find(i => i.id === activeId) : null

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  const itemForModal = itemModalId ? allItems.find(i => i.id === itemModalId) : null

  function handleOpenDetail(id: string) {
    if (id.startsWith('story-virtual-')) {
      const storyId = id.replace('story-virtual-', '')
      const story = stories.find(s => s.id === storyId)
      if (story) {
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
    } else {
      setItemModalId(id)
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

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/projects" className="w-7 h-7 rounded-md bg-primary flex items-center justify-center hover:bg-primary/90 transition">
            <span className="text-xs font-black text-primary-foreground">A</span>
          </Link>
          <nav className="text-sm text-muted-foreground">
            <Link to="/projects" className="hover:text-foreground transition">Projetos</Link>
            <span className="mx-2">›</span>
            <span className="text-foreground font-medium">Board</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 transition ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('tree')}
              className={`px-3 py-1.5 transition ${view === 'tree' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Árvore
            </button>
          </div>
          <LanguageSelector />
          <ThemeToggle />
          <Link
            to={`/projects/${projectId}/settings`}
            className="text-muted-foreground hover:text-foreground transition text-sm"
          >
            ⚙
          </Link>
          <ProfileDropdown />
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-border bg-card/50 px-6 py-2 flex items-center gap-1.5 flex-shrink-0 text-sm flex-wrap">
        <BoardFilters
          modules={modules}
          sprints={sprints}
          members={members}
          squads={projectSquads}
          tags={projectTags}
          filters={filters}
          onChange={setFilters}
          showSubtasks={showSubtasks}
          onToggleSubtasks={() => setShowSubtasks(v => !v)}
          showStories={showStories}
          onToggleStories={() => setShowStories(v => !v)}
          showExpandCollapse={view === 'kanban'}
          onExpandAll={() => setCollapsedEpics(new Set())}
          onCollapseAll={() => setCollapsedEpics(new Set([...epics.map(e => e.id), 'orphan']))}
        />
        <Tooltip label="Itens arquivados">
          <button
            onClick={openArchivedModal}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition flex-shrink-0"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        {view === 'kanban' && (
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEpicModalData({})}
              className="flex items-center gap-1.5 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              + Épico
            </button>
            <button
              onClick={() => setStoryModalData({})}
              className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition"
            >
              <BookOpen className="w-3.5 h-3.5" />
              + História
            </button>
            <button
              onClick={() => setNewItemCreation({ type: 'TASK', columnId: columns[0]?.id, title: 'Nova Task' })}
              className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              + Task
            </button>
            <button
              onClick={() => setNewItemCreation({ type: 'BUG', columnId: columns[0]?.id, title: 'Novo Bug' })}
              className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
            >
              <Bug className="w-3.5 h-3.5" />
              + Bug
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {view === 'tree' && projectId && (
          <TreeViewPage
            projectId={projectId}
            filters={filters}
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
          <div className="p-6">
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
              onDragOver={(e) => { if (e.over) lastOverRef.current = e.over.id.toString() }}
              onDragEnd={(e) => {
                const effectiveOver = e.over?.id?.toString() ?? lastOverRef.current ?? undefined
                lastOverRef.current = null
                handleDragEnd(e, effectiveOver)
              }}
              onDragCancel={() => { lastOverRef.current = null; setActiveId(null) }}
            >
              {/* Swimlane itens órfãos */}
              {orphanCards.length > 0 && (
                <Swimlane
                  swimlaneId="orphan"
                  title="Sem épico"
                  columns={columns}
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

              {/* Swimlanes por épico — exibe todos os épicos, inclusive os sem tasks
                  Tarefa 11 — hideEmptyEpics filtra os sem cards em epicGroups (memo acima) */}
              {epicGroups.map(({ epic, tasks: epicTasks }) => (
                <Swimlane
                  key={epic.id}
                  swimlaneId={epic.id}
                  title={epic.title}
                  columns={columns}
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
                  onEditEpic={() => setEpicModalData({
                    epic: { id: epic.id, title: epic.title, moduleId: epic.moduleId ?? '', description: epic.description },
                  })}
                />
              ))}

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
            <h3 className="font-semibold text-foreground mb-2">Arquivar item</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Este item possui <strong>{archiveConfirm.childrenCount}</strong> descendente(s) que também serão arquivados em cascata. Deseja continuar?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeArchive(archiveConfirm.itemId)}
                className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
              >
                Arquivar tudo
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
                Itens Arquivados
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
                      <th className="pb-2 text-left font-medium">Título</th>
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
                            {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-2.5 text-right">
                            {/* Tarefa 10.6 — botão Restaurar */}
                            <button
                              onClick={() => handleUnarchive(item.id)}
                              className="text-xs text-primary hover:underline font-medium px-2 py-1 rounded hover:bg-primary/10 transition"
                            >
                              Restaurar
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
            parentId: null,
            assigneeId: null,
            assignee: null,
            itemTags: [],
            taskTags: [],
            isLeaf: true,
            ancestryPath: '[]',
            // Tarefa 9.2 — pré-seleciona o primeiro centro de custo (igual ao que o backend atribui)
            costCenterId: projectCostCenters[0]?.id ?? null,
          }}
          projectId={projectId}
          epics={epicsForModal}
          stories={storiesForSelector}
          projectTags={projectTags}
          members={members}
          currentUserId={user?.id}
          projectVersions={projectVersions}
          projectCostCenters={projectCostCenters}
          onClose={() => setNewItemCreation(null)}
          onSave={handleModalCreate}
          onAddSubtask={handleAddSubtask}
          onCreateTag={handleCreateTag}
          onEditTag={handleEditTag}
          onCreateStory={handleCreateStory}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

interface SwimlaneProps {
  swimlaneId: string
  title: string
  columns: Column[]
  tasks: ItemData[]
  collapsed: boolean
  onToggle: () => void
  columnAddForms: Record<string, boolean>
  onShowAddForm: (colId: string) => void
  onHideAddForm: (colId: string) => void
  onCardCreate: (colId: string, title: string, type: ItemType) => Promise<void>
  onOpenDetail: (id: string) => void
  onTitleSave: (id: string, title: string) => void
  onDelete?: (id: string) => void
  // Tarefa 10.1 — callback de arquivamento passado para os KanbanCards
  onArchive?: (id: string) => void
  onEditEpic: (() => void) | null
}

function Swimlane({
  swimlaneId,
  title,
  columns,
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
}: SwimlaneProps) {
  const countByCol = Object.fromEntries(columns.map(c => [c.id, tasks.filter(t => t.columnId === c.id).length]))
  const columnSortableIds = columns.map(c => `${swimlaneId}:col:${c.id}`)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 w-full mb-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 text-left group"
        >
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-foreground">{title}</span>
          <div className="flex gap-2">
            {columns.map(col => (
              <span key={col.id} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {col.name}: {countByCol[col.id] ?? 0}
              </span>
            ))}
          </div>
        </button>
        {onEditEpic && (
          <button
            onClick={onEditEpic}
            className="text-muted-foreground hover:text-foreground transition flex-shrink-0 p-1 rounded hover:bg-muted"
            title="Editar épico"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <SortableContext
          id={`cols-${swimlaneId}`}
          items={columnSortableIds}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ minHeight: 120 }}>
            {columns.map(col => {
              const colTasks = tasks.filter(t => t.columnId === col.id)
              const sortableId = `${swimlaneId}:col:${col.id}`
              return (
                <SortableColumn key={col.id} id={sortableId} colName={col.name} colCount={colTasks.length}>
                  <DroppableColumn colId={col.id}>
                    <div className="flex-1 px-3 space-y-2">
                      <SortableContext
                        id={`${swimlaneId}-cards-${col.id}`}
                        items={colTasks.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {colTasks.map(task => (
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
                      {columnAddForms[col.id] ? (
                        <AddCardForm
                          onAdd={(title, type) => onCardCreate(col.id, title, type)}
                          onCancel={() => onHideAddForm(col.id)}
                        />
                      ) : (
                        <button
                          onClick={() => onShowAddForm(col.id)}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar card
                        </button>
                      )}
                    </div>
                  </DroppableColumn>
                </SortableColumn>
              )
            })}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

function SortableColumn({ id, colName, colCount, children }: {
  id: string
  colName: string
  colCount: number
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined }}
      className="flex-shrink-0 w-72 bg-muted/30 rounded-xl flex flex-col"
    >
      <div className="p-3 pb-1 cursor-grab active:cursor-grabbing select-none" {...attributes} {...listeners}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" fill="currentColor" viewBox="0 0 8 16">
              <circle cx="2" cy="2" r="1.5" /><circle cx="6" cy="2" r="1.5" />
              <circle cx="2" cy="8" r="1.5" /><circle cx="6" cy="8" r="1.5" />
              <circle cx="2" cy="14" r="1.5" /><circle cx="6" cy="14" r="1.5" />
            </svg>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{colName}</span>
          </div>
          <span className="text-xs text-muted-foreground">{colCount}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

function DroppableColumn({ colId, children }: { colId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col transition-colors rounded-b-xl ${isOver ? 'bg-primary/5' : ''}`}
    >
      {children}
    </div>
  )
}
