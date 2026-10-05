// Card T19 — store do foco da interface por aba do navegador (em memória).
//
// Cada modal de item publica seu nível (profundidade, item, aba ativa e objeto
// interno selecionado); o item em primeiro plano é o de maior profundidade.
// O estado é volátil (não vai para localStorage) e isolado por aba.
import type {
  AssistantFocusEntity,
  AssistantFocusLevel,
  AssistantItemArea,
  AssistantScreenSnapshot,
} from '@azy-board/assistant-contracts'

export interface FocusLevelState {
  depth: number
  itemId: string
  type: 'EPIC' | 'STORY' | 'TASK' | 'BUG'
  activeTab: AssistantItemArea
  activeEntity: AssistantFocusEntity | null
}

export type AssistantFocusState = AssistantScreenSnapshot['focus']

const byProject = new Map<string, Map<number, FocusLevelState>>()
type Listener = (state: AssistantFocusState, projectId: string) => void
const listeners = new Set<Listener>()

export function emptyFocusState(): AssistantFocusState {
  return { modalStack: 0, modalPath: [], activeItemId: null, activeTab: null, activeEntity: null, hasUnsavedChanges: false }
}

export function getFocusState(projectId: string): AssistantFocusState {
  const levels = byProject.get(projectId)
  if (!levels || levels.size === 0) return emptyFocusState()
  const ordered = [...levels.values()].sort((a, b) => a.depth - b.depth)
  const top = ordered[ordered.length - 1]!
  return {
    modalStack: ordered.length,
    modalPath: ordered.map((level): AssistantFocusLevel => ({ itemId: level.itemId, type: level.type })),
    activeItemId: top.itemId,
    activeTab: top.activeTab,
    activeEntity: top.activeEntity ?? null,
    hasUnsavedChanges: false,
  }
}

function notify(projectId: string): void {
  const state = getFocusState(projectId)
  for (const listener of listeners) listener(state, projectId)
}

export function subscribeFocus(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishFocusLevel(projectId: string, level: FocusLevelState): void {
  let levels = byProject.get(projectId)
  if (!levels) { levels = new Map(); byProject.set(projectId, levels) }
  levels.set(level.depth, level)
  notify(projectId)
}

export function clearFocusLevel(projectId: string, depth: number): void {
  const levels = byProject.get(projectId)
  if (!levels) return
  levels.delete(depth)
  if (levels.size === 0) byProject.delete(projectId)
  notify(projectId)
}
