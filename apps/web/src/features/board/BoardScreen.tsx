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
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateTree } from '../../lib/queryKeys'
import { KanbanCard } from '../../components/KanbanCard'
import type { EpicData } from '../../components/EpicModal'
import type { StoryData } from '../../components/StoryModal'
import { ActiveFilterChips, removeActiveBoardFilter, type ActiveFilterKey } from '../../components/ActiveFilterChips'
import { CompactFilterSummary } from '../../components/CompactFilterSummary'
import { useToast } from '../../components/Toast'
import { TreeViewPage, type TreeActionContext } from '../../pages/TreeViewPage'
import { useAuth } from '../../contexts/AuthContext'
import { AppShell } from '../../components/AppShell'
import { BoardCommandBar } from '../../components/BoardCommandBar'
import { BoardContextHeader, BoardStatusRail } from '../../components/BoardContext'
import type { ItemType } from '@azy-board/domain'
import { useBoardPreferences } from './hooks/useBoardPreferences'
import { useBoardData } from './hooks/useBoardData'
import { BoardLanes } from './components/BoardLanes'
import { BoardModals } from './components/BoardModals'
import { useBoardInteraction } from './hooks/useBoardInteraction'
import { useBoardArchiving } from './hooks/useBoardArchiving'
import { useBoardItemEditing } from './hooks/useBoardItemEditing'
import { useBoardItemModal } from './hooks/useBoardItemModal'
import { useBoardAgentSession } from './hooks/useBoardAgentSession'
import { useBoardFilterValidation } from './hooks/useBoardFilterValidation'
import { resolveBoardModalTarget } from './model/interaction'
import { buildEpicGroups, groupEpicsByModule, selectBoardCards, selectOrphanCards, selectStoryVirtualCards } from './model/boardView'
import type { ItemData } from './model/types'

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
    advancedChecklists,
    projectIcon, projectColor,
    loading, setLoading,
    syncState,
    invalidateBoard,
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
  const queryClient = useQueryClient()
  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const location = useLocation()
  const [newModuleName, setNewModuleName] = useState('')
  const [newModuleDescription, setNewModuleDescription] = useState('')
  // Tarefa 10 — arquivamento

  useEffect(() => {
    const itemId = searchParams.get('itemId')
    if (itemId && allItems.some(item => item.id === itemId)) setItemModalId(itemId)
  }, [allItems, searchParams])



  // Ref para preservar o over ID mais recente durante o drag (evita perder o alvo no momento do drop)
  const lastOverRef = useRef<string | null>(null)



  useEffect(() => {
    document.title = projectName ? `${projectName} · Board` : 'Board'
    return () => { document.title = 'Board' }
  }, [projectName])


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Prioriza elementos menores (cards) sobre elementos maiores (colunas) na detecção de colisão
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // O ponteiro permanece capturado pelo grip do card arrastado; ignorar o
    // próprio item evita que ele seja escolhido como destino do reorder.
    const hits = pointerWithin(args).filter(hit => hit.id !== args.active.id)
    if (hits.length > 0) {
      const itemIds = new Set(allItems.map(item => item.id))
      return [...hits].sort((left, right) => {
        const score = (id: string) => itemIds.has(id) ? 0 : id.includes(':drop:') ? 1 : id.includes(':col:') ? 2 : 3
        return score(left.id.toString()) - score(right.id.toString())
      })
    }
    return rectIntersection(args).filter(hit => hit.id !== args.active.id)
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
  useBoardFilterValidation({
    filters, setFilters, isSimpleBoard, versionsLoaded, projectVersions,
    sprints, costCentersLoaded, projectCostCenters,
  })


  // IDs das STORYs — usados para identificar TASK/BUG de primeiro nível
  const storyIdSet = useMemo(() => new Set(stories.map(s => s.id)), [stories])

  const boardCards = useMemo(() => selectBoardCards({
    allItems, filters, columns, epics, stories, storyIdSet, squadMembersMap, isSimpleBoard,
  }), [allItems, filters, columns, epics, stories, storyIdSet, squadMembersMap, isSimpleBoard])

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
    sprintEmpty: tBoard('noSprint'), versionEmpty: tBoard('noVersion'), assigneeEmpty: tBoard('unassigned'), authorEmpty: tBoard('noAuthor'), costCenterEmpty: tBoard('noCostCenter'),
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
      projectIcon={projectIcon}
      projectColor={projectColor}
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
      <div className={`h-full min-h-0 flex flex-col ${density === 'compact' ? 'gap-2' : 'gap-3'}`}>
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
          />
        )}
        <div className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-border/80 bg-canvas ${density === 'compact' ? 'density-compact' : ''}`}>
        {view === 'tree' && projectId && (
           <TreeViewPage
           projectId={projectId!}
             filters={filters}
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
                  onArchive={archiving.requestArchive}
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
