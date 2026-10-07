// Controller da sessão do agente no board: assinatura de comandos de visão
// (Card T17/T18), baseline do histórico, foco da interface (T19) e a fotografia
// do contexto da tela (T16). As assinaturas têm cleanup por projeto e a
// fotografia preserva o schema existente (`buildScreenSnapshot`).
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { AncestorNode } from '@azy-board/ui-contracts'
import type { AssistantScreenSnapshot } from '@azy-board/assistant-contracts'
import { buildScreenSnapshot } from '../../../lib/assistantSnapshot'
import { subscribeViewSession, syncCurrentViewSession } from '../../../lib/assistantViewStore'
import { emptyFocusState, getFocusState, subscribeFocus, type AssistantFocusState } from '../../../lib/assistantFocusStore'
import type { BoardFilterState } from '../../../components/BoardFilters'
import type { ItemData } from '../model/types'

export interface BoardAgentSessionOptions {
  projectId?: string
  projectName: string
  route: string
  filters: BoardFilterState
  setFilters: Dispatch<SetStateAction<BoardFilterState>>
  view: 'kanban' | 'tree'
  setView: Dispatch<SetStateAction<'kanban' | 'tree'>>
  activeModuleId: string | null
  setActiveModuleId: Dispatch<SetStateAction<string | null>>
  itemModalId: string | null
  setItemModalId: Dispatch<SetStateAction<string | null>>
  storyModalId?: string
  epicModalId?: string
  collapsedEpics: Set<string>
  collapsedModules: Set<string>
  collapsedStories: Set<string>
  setCollapsedEpics: Dispatch<SetStateAction<Set<string>>>
  setCollapsedModules: Dispatch<SetStateAction<Set<string>>>
  setCollapsedStories: Dispatch<SetStateAction<Set<string>>>
  allItems: ItemData[]
  allDisplayed: ItemData[]
}

export interface AssistantSelectedItem {
  id: string
  title: string
  type: ItemData['type']
  ancestry: AncestorNode[]
}

export function useBoardAgentSession(options: BoardAgentSessionOptions) {
  const {
    projectId, projectName, route, filters, setFilters, view, setView,
    activeModuleId, setActiveModuleId, itemModalId, setItemModalId,
    storyModalId, epicModalId, collapsedEpics, collapsedModules, collapsedStories,
    setCollapsedEpics, setCollapsedModules, setCollapsedStories, allItems, allDisplayed,
  } = options

  // Card T17 — aplica comandos de interface emitidos pela conversa nesta aba.
  // Card T18 — reveal_item expande os grupos responsáveis por esconder o item.
  useEffect(() => {
    // [TENANT] a sessão de visão é isolada por projeto; eventos de outro projeto são ignorados.
    if (!projectId) return
    return subscribeViewSession((session, pid) => {
      if (pid !== projectId) return
      setFilters(session.filters)
      setView(session.mode)
      setActiveModuleId(session.activeModuleId)
      setItemModalId(session.openItemId)
      if (session.expandGroupIds?.length) {
        const expand = new Set(session.expandGroupIds)
        setCollapsedEpics(previous => new Set([...previous].filter(id => !expand.has(id))))
        setCollapsedModules(previous => new Set([...previous].filter(id => !expand.has(id))))
        setCollapsedStories(previous => new Set([...previous].filter(id => !expand.has(id))))
      }
    })
  }, [projectId, setFilters, setView, setActiveModuleId, setItemModalId, setCollapsedEpics, setCollapsedModules, setCollapsedStories])

  // Card T17 — publica o estado corrente como baseline do histórico da visão.
  useEffect(() => {
    if (!projectId) return
    syncCurrentViewSession(projectId, { filters, mode: view, activeModuleId, openItemId: itemModalId })
  }, [projectId, filters, view, activeModuleId, itemModalId])

  // Card T19 — foco da interface (pilha de modais, item em primeiro plano, aba
  // ativa e objeto interno) publicado pelas modais de item.
  const [focusState, setFocusState] = useState<AssistantFocusState>(() => projectId ? getFocusState(projectId) : emptyFocusState())
  useEffect(() => {
    if (!projectId) return
    setFocusState(getFocusState(projectId))
    return subscribeFocus((state, pid) => { if (pid === projectId) setFocusState(state) })
  }, [projectId])

  const assistantSelectedItem = useMemo<AssistantSelectedItem | null>(() => {
    // Card T19 — o item em primeiro plano (topo da pilha de modais) tem precedência.
    const selectedId = focusState.activeItemId ?? itemModalId ?? storyModalId ?? epicModalId
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
  }, [allItems, epicModalId, itemModalId, storyModalId, focusState.activeItemId])

  // Fotografia do contexto da tela (Card T16): mesma população determinada por
  // filtros/visualização. Sem filtro nenhum, escopo ALL — sem lista de IDs.
  const [treeSnapshot, setTreeSnapshot] = useState<AssistantScreenSnapshot | null>(null)
  const handleTreeSnapshot = useCallback((snapshot: AssistantScreenSnapshot | null) => setTreeSnapshot(snapshot), [])

  const kanbanSnapshot = useMemo(() => {
    if (!projectId) return null
    const actionCards = allDisplayed.filter(item => (item.type === 'TASK' || item.type === 'BUG') && !item.id.startsWith('story-virtual-'))
    const revisions: Record<string, string> = {}
    for (const item of actionCards) if (item.updatedAt) revisions[item.id] = item.updatedAt
    return buildScreenSnapshot({
      screen: view === 'tree' ? 'project-board-tree' : 'project-board-kanban',
      route,
      projectId,
      projectName,
      viewMode: view === 'tree' ? 'tree' : 'kanban',
      activeModuleId: filters.moduleId || null,
      collapsedGroupIds: [...new Set([...collapsedEpics, ...collapsedModules, ...collapsedStories])],
      filters: {
        sprintId: filters.sprintId,
        versionId: filters.versionId,
        assigneeId: filters.assigneeId,
        authorId: filters.authorId,
        squadId: filters.squadId,
        costCenterId: filters.costCenterId,
        status: filters.status,
        priority: filters.priority,
        tagIds: filters.tagIds.length ? filters.tagIds : null,
        types: filters.types.length ? filters.types : null,
      },
      presentation: {
        showSubtasks: filters.showSubtasks,
        storyDisplay: filters.storyDisplay,
        moduleViewMode: filters.moduleViewMode,
        hideEmptyEpics: filters.hideEmptyEpics,
        hideEmptyStories: filters.hideEmptyStories,
      },
      focus: focusState,
      actionCardIds: actionCards.map(item => item.id),
      revisions,
    })
  }, [allDisplayed, projectId, projectName, route, view, filters, collapsedEpics, collapsedModules, collapsedStories, focusState])

  const assistantScreenSnapshot = view === 'tree' ? treeSnapshot : kanbanSnapshot

  return { focusState, assistantSelectedItem, handleTreeSnapshot, assistantScreenSnapshot }
}
