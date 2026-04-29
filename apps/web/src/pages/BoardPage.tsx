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
import { UserAvatar } from '../components/UserAvatar'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageSelector } from '../components/LanguageSelector'
import { AddCardForm } from '../components/AddCardForm'
import { ItemModal, type FullItemData, type ProjectMember, type ProjectVersion } from '../components/ItemModal'
import { EpicModal, type EpicData } from '../components/EpicModal'
import { StoryModal, type StoryData } from '../components/StoryModal'
import { BoardFilters, type BoardFilterState } from '../components/BoardFilters'
import { useToast } from '../components/Toast'
import { TreeViewPage } from './TreeViewPage'
import { useAuth } from '../contexts/AuthContext'
import { Layers, BookOpen, CheckSquare, Bug, Plus, Pencil } from 'lucide-react'
import type { WsEvent, ItemType, AncestorNode } from '@azy-board/types'
import type { Tag } from '../components/TagSelector'

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
    moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [],
  })
  const [newItemCreation, setNewItemCreation] = useState<{ type: 'TASK' | 'BUG'; columnId?: string; title?: string } | null>(null)

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
    ]).then(([cols, its, mods, tags, sprs, mbrs, vers]) => {
      setColumns(cols)
      setAllItems(computeIsLeaf(its))
      setModules(mods)
      setProjectTags(tags)
      setSprints(sprs)
      setMembers(mbrs)
      setProjectVersions(vers)
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
    if (filters.types.length > 0) {
      result = result.filter(i => filters.types.includes(i.type as ItemType))
    }
    if (filters.tagIds.length > 0) {
      result = result.filter(i =>
        (i.itemTags ?? i.taskTags ?? []).some((it: { tag: Tag }) => filters.tagIds.includes(it.tag.id))
      )
    }
    return result
  }, [allItems, showSubtasks, storyIdSet, filters, epics])

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
  const epicGroups = useMemo(() => {
    return epics.map(epic => {
      const epicCards = allDisplayed.filter(i =>
        getEpicIdFromPath(i.ancestryPath) === epic.id
      )
      return { epic, tasks: epicCards }
    })
  }, [epics, allDisplayed])

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
          <UserAvatar user={user!} size="sm" />
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-border bg-card/50 px-6 py-2 flex items-center gap-3 flex-shrink-0 text-sm flex-wrap">
        <button
          onClick={() => setShowSubtasks(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition flex-shrink-0 ${
            showSubtasks
              ? 'bg-primary/10 border-primary/40 text-primary font-medium'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {showSubtasks ? 'Ocultar subtasks' : 'Mostrar subtasks'}
        </button>
        <button
          onClick={() => setShowStories(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition flex-shrink-0 ${
            showStories
              ? 'bg-primary/10 border-primary/40 text-primary font-medium'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Histórias no board
        </button>
        <span className="w-px h-4 bg-border flex-shrink-0" />
        <BoardFilters
          modules={modules}
          sprints={sprints}
          members={members}
          tags={projectTags}
          filters={filters}
          onChange={setFilters}
        />
        {view === 'kanban' && (
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEpicModalData({})}
              className="flex items-center gap-1.5 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              Novo Épico
            </button>
            <button
              onClick={() => setStoryModalData({})}
              className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Nova História
            </button>
            <button
              onClick={() => setNewItemCreation({ type: 'TASK', columnId: columns[0]?.id, title: 'Nova Task' })}
              className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Nova Task
            </button>
            <button
              onClick={() => setNewItemCreation({ type: 'BUG', columnId: columns[0]?.id, title: 'Novo Bug' })}
              className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
            >
              <Bug className="w-3.5 h-3.5" />
              Novo Bug
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {view === 'tree' && projectId && (
          <TreeViewPage projectId={projectId} filters={filters} />
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
                  onEditEpic={null}
                />
              )}

              {/* Swimlanes por épico — exibe todos os épicos, inclusive os sem tasks */}
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
          }}
          projectId={projectId}
          epics={epicsForModal}
          stories={storiesForSelector}
          projectTags={projectTags}
          members={members}
          currentUserId={user?.id}
          projectVersions={projectVersions}
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
