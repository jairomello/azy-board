// Composition root do Board (kanban/tree).
//
// Fronteiras: esta tela apenas compõe dados, controllers e componentes. HTTP,
// regras de filtro/população, DnD, edição/arquivamento, carregamento de modal e
// sessão/fotografia do agente vivem em módulos próprios:
//   - model/boardView.ts                     → filtros/população/agrupamento
//   - model/{interaction,mutation}.ts        → helpers puros e política otimista
//   - hooks/useBoardData                     → cache remoto + reducer de eventos
//   - hooks/useBoardPreferences              → preferências por projeto
//   - hooks/useBoardInteraction              → DnD/mutações
//   - hooks/useBoardItemEditing              → edição/criação (itens, tags, épico, história, módulo)
//   - hooks/useBoardItemModal                → detalhe do item com cancelamento de resposta antiga
//   - hooks/useBoardArchiving                → arquivamento/restauração
//   - hooks/useBoardFilterValidation         → coerência dos filtros vs catálogos
//   - hooks/useBoardAgentSession             → comandos de visão, foco e snapshot (T16–T19)
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DropAnimationFunction,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import { invalidateTree } from '../../lib/queryKeys'
import { KanbanCard } from '../../components/KanbanCard'
import type { EpicData } from '../../components/EpicModal'
import type { StoryData } from '../../components/StoryModal'
import { ActiveFilterChips, removeActiveBoardFilter, type ActiveFilterKey } from '../../components/ActiveFilterChips'
import { CompactFilterSummary } from '../../components/CompactFilterSummary'
import { useToast } from '../../components/Toast'
import { api } from '../../lib/api'
import { TreeViewPage, type TreeActionContext } from '../../pages/TreeViewPage'
import { useAuth } from '../../contexts/AuthContext'
import { AppShell } from '../../components/AppShell'
import { BoardCommandBar } from '../../components/BoardCommandBar'
import { BoardContextHeader, BoardStatusRail } from '../../components/BoardContext'
import { itemsAdvance, type ItemType } from '@azy-board/domain'
import { cardAdvance, columnAdvanceBands } from './model/cardAdvance'
import { useBoardPreferences } from './hooks/useBoardPreferences'
import { useBoardData } from './hooks/useBoardData'
import { BoardLanes } from './components/BoardLanes'
import { BoardModals } from './components/BoardModals'
import { ProjectPlanningModal } from '../../components/ProjectPlanningModal'
import { useBoardInteraction } from './hooks/useBoardInteraction'
import { useBoardArchiving } from './hooks/useBoardArchiving'
import { useBoardItemEditing } from './hooks/useBoardItemEditing'
import { useBoardItemModal } from './hooks/useBoardItemModal'
import { useBoardAgentSession } from './hooks/useBoardAgentSession'
import { useBoardFilterValidation } from './hooks/useBoardFilterValidation'
import { BoardDragAnimationProvider, useBoardDragAnimation } from './hooks/useBoardDragAnimation'
import {
  CARD_REORDER_TRANSITION,
  DRAG_OVERLAY_SETTLING_CLASS,
  DRAG_OVERLAY_DURATION_VAR,
  dropDuration,
  toTranslateKeyframe,
  type DragTargetRect,
} from './model/dragAnimation'
import { dropAnchor, type PreviewColumn } from './model/dragPreview'

import { resolveBoardModalTarget, resolveCreationIntent, type NewItemCreation } from './model/interaction'
import { buildEpicGroups, groupEpicsByModule, selectBoardCards, selectOrphanCards, selectStoryVirtualCards } from './model/boardView'
import type { ItemData } from './model/types'
import { applyViewCommand, readPinnedResult, subscribeViewSession } from '../../lib/assistantViewStore'
import { VIEW_COMMAND_SCHEMA_VERSION, type AssistantPlanningResult } from '@azy-board/assistant-contracts'

/** Retângulo de viewport de um elemento, para a prévia e para o assentamento. */
function measureRect(element: Element | null): DragTargetRect | null {
  if (!element) return null
  const { left, right, top, bottom } = element.getBoundingClientRect()
  return { left, right, top, bottom }
}

/** Nó do card pelo id; o overlay também tem `data-card-id`, então o primeiro serve. */
function cardNode(activeId: string): Element | null {
  return Array.from(document.querySelectorAll('[data-card-id]'))
    .find(node => (node as HTMLElement).dataset.cardId === activeId) ?? null
}

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
    sprints,
    members,
    projectTags, setProjectTags,
    projectVersions,
    versionsLoaded,
    costCentersLoaded,
    projectCostCenters,
    projectSquads,
    projectName,
    boardMode,
    simpleStoryId,
    hideModules,
    hideEpics,
    advancedChecklists,
    projectIcon, projectColor,
    loading,
    syncState,
    invalidateBoard,
    cancelBoardReads,
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
  // Card T26 — recorte fixado de um resultado de lacunas; escopa a exibição ao
  // conjunto exato sem reconverter a expressão em filtros do toolbar.
  const [pinnedResult, setPinnedResult] = useState<AssistantPlanningResult | null>(() => projectId ? readPinnedResult(projectId) : null)
  const [itemModalId, setItemModalId] = useState<string | null>(null)
  const [storyModalData, setStoryModalData] = useState<{ story?: StoryData } | null>(null)
  const [epicModalData, setEpicModalData] = useState<{ epic?: EpicData } | null>(null)
  const [columnAddForms, setColumnAddForms] = useState<Record<string, boolean>>({})
  const [newItemCreation, setNewItemCreation] = useState<NewItemCreation | null>(null)
  // Card T48/T49 — cronograma: recálculo explícito e destaque do caminho crítico.
  const [showCriticalPath, setShowCriticalPath] = useState(false)
  const [criticalIds, setCriticalIds] = useState<ReadonlySet<string>>(new Set())
  const [recalculating, setRecalculating] = useState(false)
  const queryClient = useQueryClient()
  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const [planningOpen, setPlanningOpen] = useState(false)
  const location = useLocation()
  const [newModuleName, setNewModuleName] = useState('')
  const [newModuleDescription, setNewModuleDescription] = useState('')
  // Tarefa 10 — arquivamento

  useEffect(() => {
    const itemId = searchParams.get('itemId')
    if (itemId && allItems.some(item => item.id === itemId)) setItemModalId(itemId)
  }, [allItems, searchParams])

  // Card T26 — assina o recorte fixado por aba e projeto.
  useEffect(() => {
    if (!projectId) { setPinnedResult(null); return }
    setPinnedResult(readPinnedResult(projectId))
    return subscribeViewSession((session, pid) => { if (pid === projectId) setPinnedResult(session.pinnedResult ?? null) })
  }, [projectId])

  // População apresentável: folhas do resultado + ancestrais apenas para navegação.
  const scopedAllItems = useMemo(() => {
    if (!pinnedResult) return allItems
    const allowed = new Set([...pinnedResult.itemIds, ...pinnedResult.ancestorIds])
    return allItems.filter(item => allowed.has(item.id))
  }, [allItems, pinnedResult])

  const restorePinnedView = useCallback(() => {
    if (!projectId) return
    applyViewCommand(projectId, {
      schemaVersion: VIEW_COMMAND_SCHEMA_VERSION,
      commandId: crypto.randomUUID(),
      type: 'restore_previous_view',
    })
  }, [projectId])



  // Ref para preservar o over ID mais recente durante o drag (evita perder o alvo no momento do drop)
  const lastOverRef = useRef<string | null>(null)



  useEffect(() => {
    document.title = projectName ? `${projectName} · Board` : 'Board'
    return () => { document.title = 'Board' }
  }, [projectName])


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Prioriza elementos menores (cards) sobre elementos maiores (colunas) na detecção de colisão.
  //
  // Card T89 — só há destino quando o **ponteiro** está sobre uma coluna. O
  // `rectIntersection` de fallback devolvia um alvo a partir do retângulo do card
  // (que se estende além do ponteiro), o que fazia a prévia avançar para uma
  // posição que a soltura fora das colunas depois recusava. Sem colisão, o
  // dnd-kit mantém o card na origem e a reversão assenta exatamente onde ele estava.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // O ponteiro permanece capturado pelo grip do card arrastado; ignorar o
    // próprio item evita que ele seja escolhido como destino do reorder.
    const hits = pointerWithin(args).filter(hit => hit.id !== args.active.id)
    if (hits.length === 0) return []
    const itemIds = new Set(allItems.map(item => item.id))
    return [...hits].sort((left, right) => {
      const score = (id: string) => itemIds.has(id) ? 0 : id.includes(':drop:') ? 1 : id.includes(':col:') ? 2 : 3
      return score(left.id.toString()) - score(right.id.toString())
    })
  }, [allItems])

  // Card T89 — medição do quadro no início do arraste: cada coluna com seus cards
  // (posições e altura) e o espaço entre eles, mais o card arrastado. A prévia é
  // resolvida sobre esta geometria, sem depender das transforms do sortable.
  const measureDragAnimation = useCallback((activeId: string) => {
    const columns: PreviewColumn[] = []
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-drop-id]'))) {
      const id = element.dataset.dropId ?? ''
      const columnId = id.split(':col:')[1]
      if (!columnId) continue
      const caixa = element.getBoundingClientRect()
      const cards = Array.from(element.querySelectorAll<HTMLElement>('.board-column-cards > .kanban-card')).map(card => {
        const retangulo = card.getBoundingClientRect()
        return { id: card.dataset.cardId ?? '', top: retangulo.top, bottom: retangulo.bottom, height: retangulo.height }
      }).filter(card => card.id !== '')
      columns.push({
        id,
        columnId,
        rect: { left: caixa.left, right: caixa.right, top: caixa.top, bottom: caixa.bottom },
        cards,
        gap: cards.length > 1 ? Math.max(0, cards[1]!.top - cards[0]!.bottom) : 8,
      })
    }
    const node = cardNode(activeId)
    const retangulo = node?.getBoundingClientRect()
    const origem = node?.closest<HTMLElement>('[data-drop-id]')?.dataset.dropId?.split(':col:')[1]
    return {
      columns,
      source: retangulo && origem ? { id: activeId, columnId: origem, height: retangulo.height } : null,
    }
  }, [])

  const dragAnimation = useBoardDragAnimation(measureDragAnimation)
  // Retângulo para onde o overlay assenta (a vaga, ou a origem na recusa) e a
  // validade do destino, lidos na soltura.
  const settleRef = useRef<DragTargetRect | null>(null)
  const originRectRef = useRef<DragTargetRect | null>(null)
  const settleValidRef = useRef(false)

  // Card T89 — assentamento: o overlay anima do ponteiro até o retângulo da vaga
  // (aceite curto) ou até a origem (reversão mais longa), e o wrapper do card volta a
  // ficar reto e no tamanho natural no mesmo intervalo. Sem depender do retângulo do
  // nó ativo — que fica fora do fluxo durante o arraste.
  const dropAnimation = useCallback<DropAnimationFunction>(({ dragOverlay, transform }) => {
    const alvo = settleRef.current
    const valid = settleValidRef.current
    settleRef.current = null
    originRectRef.current = null
    if (!alvo) return
    const duration = dropDuration(valid, dragAnimation.reducedMotion)
    if (duration === 0) return
    const node = dragOverlay.node
    node.style.setProperty(DRAG_OVERLAY_DURATION_VAR, `${duration}ms`)
    node.classList.add(DRAG_OVERLAY_SETTLING_CLASS)
    const quadros = [
      toTranslateKeyframe(transform),
      toTranslateKeyframe({ x: transform.x + (alvo.left - dragOverlay.rect.left), y: transform.y + (alvo.top - dragOverlay.rect.top) }),
    ] as Keyframe[]
    const animation = node.animate(quadros, { duration, easing: CARD_REORDER_TRANSITION.easing, fill: 'forwards' })
    return new Promise<void>(resolve => {
      animation.onfinish = () => {
        node.classList.remove(DRAG_OVERLAY_SETTLING_CLASS)
        node.style.removeProperty(DRAG_OVERLAY_DURATION_VAR)
        resolve()
      }
    })
  }, [dragAnimation.reducedMotion])

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

  // Items derivados por tipo (escopados pelo recorte fixado, quando houver)
  const epics = useMemo(() => scopedAllItems.filter(i => i.type === 'EPIC'), [scopedAllItems])
  const stories = useMemo(() => scopedAllItems.filter(i => i.type === 'STORY'), [scopedAllItems])
  const simpleStory = useMemo(() => (
    stories.find(story => story.id === simpleStoryId) ?? stories.find(story => !story.parentId)
  ), [simpleStoryId, stories])
  const isSimpleBoard = boardMode === 'SIMPLE'
  useBoardFilterValidation({
    filters, setFilters, isSimpleBoard, versionsLoaded, projectVersions,
    sprints, costCentersLoaded, projectCostCenters,
  })


  // IDs das STORYs — usados para identificar TASK/BUG de primeiro nível
  const storyIdSet = useMemo(() => new Set(stories.map(s => s.id)), [stories])

  const activeSprintId = useMemo(() => sprints.find(sprint => sprint.status === 'OPEN')?.id ?? null, [sprints])

  const boardCards = useMemo(() => selectBoardCards({
    allItems: scopedAllItems, filters, columns, epics, stories, storyIdSet, squadMembersMap, isSimpleBoard, activeSprintId,
  }), [scopedAllItems, filters, columns, epics, stories, storyIdSet, squadMembersMap, isSimpleBoard, activeSprintId])

  // Card T49 — o toggle de caminho crítico só é oferecido com dependências no board.
  const projectDepsAvailable = useMemo(
    () => boardCards.some(card => ((card as { dependencyCount?: number }).dependencyCount ?? 0) > 0),
    [boardCards],
  )

  async function toggleCriticalPath() {
    if (showCriticalPath) {
      setShowCriticalPath(false)
      setCriticalIds(new Set())
      return
    }
    try {
      const result = await api.get<{ criticalPath: string[]; dependencyCount: number }>(`/projects/${projectId}/schedule/critical-path`)
      if (result.dependencyCount === 0) {
        toast(tBoard('scheduleNoDependencies', { defaultValue: 'Cadastre dependências para calcular o caminho crítico.' }), 'error')
        return
      }
      setCriticalIds(new Set(result.criticalPath))
      setShowCriticalPath(true)
    } catch {
      toast(tBoard('scheduleLoadError', { defaultValue: 'Falha ao calcular o caminho crítico.' }), 'error')
    }
  }

  async function runRecalculate() {
    setRecalculating(true)
    try {
      const result = await api.post<{ updatedCount: number }>(`/projects/${projectId}/schedule/recalculate`, {})
      toast(tBoard('scheduleRecalculated', { count: result.updatedCount, defaultValue: `${result.updatedCount} item(ns) com datas ajustadas.` }))
      invalidateBoard()
    } catch {
      toast(tBoard('scheduleRecalculateError', { defaultValue: 'Falha ao recalcular as datas.' }), 'error')
    } finally { setRecalculating(false) }
  }

  // Cards virtuais de histórias NÃO-folha quando toggle "Mostrar histórias" ativo
  // Histórias folha aparecem como cards reais em boardCards (arrastáveis)
  const storyVirtualCards: ItemData[] = useMemo(
    () => selectStoryVirtualCards(stories, filters, columns),
    [stories, filters, columns],
  )

  const allDisplayed = useMemo(() => [...boardCards, ...storyVirtualCards], [boardCards, storyVirtualCards])
  const handleDragEnd = useBoardInteraction({
    projectId,
    columns,
    items: allItems,
    displayedItems: allDisplayed,
    setColumns,
    setItems: setAllItems,
    onError: toast,
    // Card T89 — a recusa do servidor restaura ordem e coluna; o quadro diz isso.
    mutationRefusedMessage: tBoard('dragMoveRefused'),
    // B16 — cancela leitura do quadro em voo: uma resposta pedida antes da soltura
    // chegava depois e devolvia o card para a coluna antiga.
    cancelPendingReads: cancelBoardReads,
  })

  const archiving = useBoardArchiving({ projectId, allItems, setAllItems, invalidateBoard, toast, tBoard })

  // Agrupar por EPIC. No modo de lanes, cada grupo contém também as histórias
  // do épico e seus cards visíveis, formando EPIC → STORY → CARD.
  const epicGroups = useMemo(() => buildEpicGroups({
    epics, stories, allDisplayed, filters, noStoryLabel: tBoard('noStory'),
  }), [epics, stories, allDisplayed, filters, tBoard])

  const orphanCards = useMemo(() => selectOrphanCards(allDisplayed), [allDisplayed])

  const moduleGroups = useMemo(() => groupEpicsByModule({
    epicGroups, modules, isSimpleBoard, noModuleLabel: tBoard('noModule'),
  }), [epicGroups, modules, isSimpleBoard, tBoard])

  useEffect(() => {
    if (moduleGroups.length === 0) {
      setActiveModuleId(null)
      return
    }
    setActiveModuleId(current => moduleGroups.some(group => group.module.id === current) ? current : moduleGroups[0]!.module.id)
  }, [moduleGroups])


  // Cria novo item TASK/BUG via modal (botões da toolbar)
  const invalidateTreeForProject = useCallback(() => {
    void invalidateTree(queryClient, user?.id, projectId)
  }, [queryClient, user?.id, projectId])

  const {
    handleModalCreate, handleCardCreate, handleTitleSave, handleModalSave, handleAddSubtask,
    handleDeleteItem, handleCreateTag, handleEditTag, handleStorySave, handleCreateStory,
    handleEpicSave, handleModuleCreate,
  } = useBoardItemEditing({
    projectId, allItems, setAllItems, columns, newItemCreation, setColumnAddForms,
    modules, setModules, newModuleName, newModuleDescription, setNewModuleName,
    setNewModuleDescription, setModuleModalOpen, setProjectTags, invalidateBoard,
    invalidateTreeForProject, toast, tBoard,
  })

  const itemModalData = useBoardItemModal(projectId, itemModalId)

  const isColumnDrag = activeId?.includes(':col:') ?? false
  const activeCard = !isColumnDrag ? allItems.find(i => i.id === activeId) : null

  const { assistantSelectedItem, handleTreeSnapshot, assistantScreenSnapshot } = useBoardAgentSession({
    projectId, projectName, route: location.pathname,
    filters, setFilters, view, setView, activeModuleId, setActiveModuleId,
    itemModalId, setItemModalId,
    storyModalId: storyModalData?.story?.id, epicModalId: epicModalData?.epic?.id,
    collapsedEpics, collapsedModules, collapsedStories,
    setCollapsedEpics, setCollapsedModules, setCollapsedStories,
    allItems, allDisplayed,
  })




  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  const itemForModal = itemModalId ? itemModalData : null

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
  // T75 — faixas de avanço das colunas, usadas pelo preview de arraste (o board calcula por card).
  const advanceBands = columnAdvanceBands(columns)
  // Avanço no fluxo do recorte exibido (mesma população do cabeçalho), separado da conclusão.
  const sprintAdvance = itemsAdvance(
    columns.map(column => ({ id: column.id, baseStatus: column.baseStatus, position: column.position, progressWeight: column.progressWeightOverride ?? null })),
    sprintItems.map(item => ({ columnId: item.columnId, checklist: item.checklistProgress ?? null })),
  )

  function openCreation(type: ItemType | 'MODULE', context: TreeActionContext = {}) {
    const intent = resolveCreationIntent(type, context, {
      columnId: columns[0]?.id,
      costCenterId: projectCostCenters[0]?.id ?? null,
    })
    if (intent.kind === 'module') setModuleModalOpen(true)
    else if (intent.kind === 'epic') setEpicModalData({ epic: intent.epic })
    else if (intent.kind === 'story') setStoryModalData({ story: intent.story })
    else setNewItemCreation(intent.item)
  }

  const visibleModuleGroups = filters.moduleViewMode === 'tabs' && !hideModules
    ? moduleGroups.filter(group => group.module.id === activeModuleId)
    : moduleGroups

  // Board sem nenhum item: projeto recém-criado, ainda sem épico/história/card.
  // Sem isso o canvas fica em branco e o usuário não descobre por onde começar.
  // Depende dos itens existentes, não dos filtros: um recorte vazio já tem o
  // aviso próprio no cabeçalho de contexto.
  const hasNoLanes = scopedAllItems.length === 0

  const activeFilterLabels = {
    filterLabel: tBoard('activeFilters'), module: tBoard('filterModule'), sprint: tBoard('filterSprint'), version: tBoard('filterVersion'),
    squad: tBoard('filterSquad'), assignee: tBoard('filterAssignee'), author: tBoard('filterAuthor'), costCenter: tBoard('filterCostCenter'),
    sprintEmpty: tBoard('noSprint'), versionEmpty: tBoard('noVersion'), assigneeEmpty: tBoard('unassigned'), authorEmpty: tBoard('noAuthor'), costCenterEmpty: tBoard('noCostCenter'),
    priority: tBoard('filterPriority'), status: tBoard('filterStatus'), type: tBoard('filterType'), tag: tBoard('filterTag'),
    updated: tBoard('filterUpdated'),
    updatedValues: { '1d': tBoard('recentLastDay'), '2d': tBoard('recent2d'), '3d': tBoard('recent3d'), '5d': tBoard('recent5d'), '1w': tBoard('recentWeek'), '1m': tBoard('recentMonth'), 'current-sprint': tBoard('recentCurrentSprint') },
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
      projectIcon={projectIcon}
      projectColor={projectColor}
      onProjectNameActivate={() => setPlanningOpen(true)}
      assistantSelectedItem={assistantSelectedItem}
      assistantScreen={view === 'tree' ? 'project-board-tree' : 'project-board-kanban'}
      assistantBoardView={view}
      assistantFilters={{ hideEmptyEpics: filters.hideEmptyEpics, hideEmptyStories: filters.hideEmptyStories, moduleId: filters.moduleId || null, sprintId: filters.sprintId || null, versionId: filters.versionId || null, squadId: filters.squadId || null, assigneeId: filters.assigneeId || null, types: filters.types.length ? filters.types.join(',') : null }}
      assistantScreenSnapshot={assistantScreenSnapshot}
       sectionLabel={view === 'kanban' ? tBoard('viewBoard') : tBoard('viewTree')}
       contextLabel={activeSprint?.name ?? tBoard('optionsDescription')}
      headerMeta={syncState === 'synced' || syncState === 'syncing' ? (
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-shell-muted">
          <span className={`w-1.5 h-1.5 rounded-full ${syncState === 'synced' ? 'bg-status-done' : 'bg-amber-500'}`} />
           {syncState === 'synced' ? tBoard('synced') : tBoard('syncing')}
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
          hideModules={hideModules}
          hideEpics={hideEpics}
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
          onOpenArchived={archiving.openArchivedModal}
          onCreate={openCreation}
          onRecalculate={() => void runRecalculate()}
          recalculating={recalculating}
          onToggleCriticalPath={() => void toggleCriticalPath()}
          criticalPathActive={showCriticalPath}
          criticalPathAvailable={projectDepsAvailable}
          progress={{ completed: sprintCompleted, total: sprintItems.length }}
          compactFilters={density === 'compact' ? (
            <CompactFilterSummary
              filters={filters}
              catalogs={{ modules, sprints, versions: projectVersions, squads: projectSquads, members, tags: projectTags, costCenters: projectCostCenters }}
              labels={activeFilterLabels}
              visualContext={{ isSimpleBoard, view }}
              onRemove={(key: ActiveFilterKey, value) => setFilters(previous => removeActiveBoardFilter(previous, key, value))}
            />
          ) : undefined}
        />
      )}
      statusRail={<BoardStatusRail syncState={syncState} visibleItems={allDisplayed.length} />}
      contentClassName="overflow-hidden"
    >
      <div className={`board-workspace h-full min-h-0 flex flex-col ${density === 'compact' ? 'gap-2' : 'gap-3'}`}>
        {pinnedResult && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
            <span className="font-semibold text-foreground">{tBoard(`planningGapLabel.${pinnedResult.labelKey}`)}</span>
            <span className="text-muted-foreground">{tBoard('planningGapTotal', { count: pinnedResult.totalDistinct, capturedAt: pinnedResult.capturedAt })}</span>
            {pinnedResult.hiddenCount > 0 && <span className="text-muted-foreground">{tBoard('planningGapHidden', { count: pinnedResult.hiddenCount })}</span>}
            <span className="ml-auto flex items-center gap-2">
              <button type="button" className="rounded-lg border border-border px-2 py-1 font-medium hover:bg-muted" onClick={() => setView('tree')}>{tBoard('planningGapViewTree')}</button>
              <button type="button" className="rounded-lg border border-border px-2 py-1 font-medium hover:bg-muted" onClick={restorePinnedView}>{tBoard('planningGapRestore')}</button>
            </span>
          </div>
        )}
        {density !== 'compact' && (
          <ActiveFilterChips
            filters={filters}
            catalogs={{ modules, sprints, versions: projectVersions, squads: projectSquads, members, tags: projectTags, costCenters: projectCostCenters }}
            labels={activeFilterLabels}
            visualContext={{ isSimpleBoard, view }}
            onRemove={(key: ActiveFilterKey, value) => setFilters(previous => removeActiveBoardFilter(previous, key, value))}
          />
        )}
        {density !== 'compact' && (
          <BoardContextHeader
            sprintName={activeSprint?.name}
            completed={sprintCompleted}
            total={sprintItems.length}
            advance={sprintAdvance}
          />
        )}
        <div className={`board-canvas min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-border/80 bg-canvas ${density === 'compact' ? 'density-compact' : ''}`}>
        {view === 'tree' && projectId && (
           <TreeViewPage
           projectId={projectId!}
             filters={filters}
             pinnedItemIds={pinnedResult ? pinnedResult.itemIds : null}
             canCreate={members.find(member => member.userId === user?.id)?.role !== 'VIEWER'}
             canEdit={members.find(member => member.userId === user?.id)?.role !== 'VIEWER'}
              onCreate={openCreation}
              onEdit={handleOpenDetail}
              onSnapshotChange={handleTreeSnapshot}
            // Tarefa 10.2 — passa o handler de arquivamento para a tree view
            onArchive={archiving.openArchiveConfirm}
          />
        )}

        {view === 'kanban' && (
          <div className="p-3 sm:p-4">
            <BoardDragAnimationProvider value={dragAnimation}>
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={(e: DragStartEvent) => {
                setActiveId(e.active.id as string)
                originRectRef.current = measureRect(cardNode(e.active.id.toString()))
                dragAnimation.onDragStart(e)
              }}
              onDragMove={(e: DragMoveEvent) => dragAnimation.onDragMove(e)}
              onDragOver={(e: DragOverEvent) => { if (e.over) lastOverRef.current = e.over.id.toString() }}
              onDragEnd={(e: DragEndEvent) => {
                const isColumnDrag = e.active.id.toString().includes(':col:')
                // A âncora da soltura vem da prévia: o card que fica depois da vaga;
                // quando a vaga é a última (ou a coluna está vazia), o marcador da
                // própria coluna manda inserir no fim. O arraste de coluna segue o `over`.
                const preview = dragAnimation.previewRef.current
                const effectiveOver = isColumnDrag
                  ? (e.over?.id?.toString() ?? lastOverRef.current ?? undefined)
                  : (dropAnchor(preview) ?? preview.targetId?.replace(':col:', ':drop:'))
                // Card B14 — a vaga da lane de destino, não a primeira do documento
                // (que poderia ser a de outra lane).
                const vagaDoDestino = preview.targetId
                  ? document.querySelector(`[data-drop-id="${preview.targetId}"] .kanban-card-placeholder`)
                  : null
                settleRef.current = measureRect(vagaDoDestino) ?? originRectRef.current
                settleValidRef.current = dragAnimation.validRef.current
                dragAnimation.onDragEnd(e)
                lastOverRef.current = null
                // Card T89 — arraste de card sem destino sob o ponteiro: a prévia
                // ficou na origem, então só resta liberar o overlay e avisar.
                if (!isColumnDrag && !settleValidRef.current) {
                  setActiveId(null)
                  toast(tBoard('dragDropCanceled'))
                  return
                }
                 handleDragEnd(e, effectiveOver)
              }}
              onDragCancel={() => {
                lastOverRef.current = null
                setActiveId(null)
                settleRef.current = originRectRef.current
                settleValidRef.current = false
                dragAnimation.onDragCancel()
              }}
            >
                {!isSimpleBoard && !hideModules && filters.moduleViewMode === 'tabs' && moduleGroups.length > 0 && (
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

                {hasNoLanes && (
                  <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">{tBoard('emptyBoardTitle')}</p>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{tBoard('emptyBoardHint')}</p>
                    {!isSimpleBoard && (
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openCreation('EPIC')}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Layers className="h-3.5 w-3.5" />{tBoard('emptyBoardCreateEpic')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <BoardLanes
                  simpleBoard={isSimpleBoard}
                  simpleStory={simpleStory}
                  simpleCards={boardCards}
                  showStoryLanes={filters.storyDisplay === 'lanes'}
                  orphanCards={orphanCards}
                  hideModules={hideModules}
                  hideEpics={hideEpics}
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
                  onArchive={archiving.requestArchive}
                  onEditStory={openStoryModal}
                  onEditEpic={epic => setEpicModalData({ epic: { id: epic.id, title: epic.title, moduleId: epic.moduleId ?? '', description: epic.description } })}
                  criticalIds={showCriticalPath ? criticalIds : null}
                  noModuleLabel={tBoard('noModule')}
                />

              <DragOverlay dropAnimation={dropAnimation}>
                {activeCard && (
                  <div className={`board-drag-overlay__card${dragAnimation.reducedMotion ? ' board-drag-overlay__card--still' : ''}`}>
                    <KanbanCard card={activeCard} advance={cardAdvance(advanceBands, activeCard)} />
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
            </BoardDragAnimationProvider>
          </div>
        )}
        </div>
      </div>

      {planningOpen && projectId && (
        <ProjectPlanningModal projectId={projectId} onClose={() => setPlanningOpen(false)} />
      )}

      <BoardModals
        projectId={projectId!}
        userId={user?.id}
        item={itemForModal}
        newItem={newItemCreation}
        story={storyModalData?.story}
        storyOpen={storyModalData !== null}
        epic={epicModalData?.epic}
        epicOpen={epicModalData !== null}
        moduleOpen={moduleModalOpen}
        moduleName={newModuleName}
        moduleDescription={newModuleDescription}
        archiveConfirm={archiving.archiveConfirm}
        archivedOpen={archiving.archivedModal}
        archivedItems={archiving.archivedItems}
        archivedLoading={archiving.archivedLoading}
        epics={epicsForModal}
        stories={storiesForSelector}
        modules={modules}
        tags={projectTags}
        members={members}
        versions={projectVersions}
        sprints={sprints}
        costCenters={projectCostCenters}
        advancedChecklists={advancedChecklists}
        hierarchical={!isSimpleBoard}
        onCloseItem={() => { setItemModalId(null); setNewItemCreation(null) }}
        onCloseStory={() => setStoryModalData(null)}
        onCloseEpic={() => setEpicModalData(null)}
        onCloseModule={() => setModuleModalOpen(false)}
        onCloseArchive={archiving.cancelArchive}
        onCloseArchived={archiving.closeArchivedModal}
        onCreate={handleModalCreate}
        onSaveItem={handleModalSave}
        onSaveStory={handleStorySave}
        onSaveEpic={handleEpicSave}
        onOpenChild={handleOpenChildFromHierarchy}
        onAddSubtask={handleAddSubtask}
        onCreateTag={handleCreateTag}
        onEditTag={handleEditTag}
        onCreateStory={handleCreateStory}
        onArchive={archiving.confirmArchive}
        onUnarchive={archiving.unarchive}
        onModuleCreate={handleModuleCreate}
        onModuleNameChange={setNewModuleName}
        onModuleDescriptionChange={setNewModuleDescription}
        t={(key, options) => tBoard(key, options)}
      />
    </AppShell>
  )
}
