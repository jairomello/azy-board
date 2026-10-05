// Card T17 — store de visão por aba do navegador.
//
// O estado aplicado por comandos da conversa vive na camada de sessão da aba
// (`sessionStorage`), prevalece sobre a preferência durável e nunca é gravado em
// `localStorage`, para não vazar para outras abas. O BoardScreen publica o estado
// corrente (baseline) e assina as mudanças aplicadas.
import { VIEW_COMMAND_SCHEMA_VERSION } from '@azy-board/assistant-contracts'
import type { AssistantScreenFilterValue, AssistantViewCommand } from '@azy-board/assistant-contracts'
import type { BoardFilterState } from '../components/BoardFilters'
import { DEFAULT_FILTERS, EMPTY_FILTER_VALUE } from '../features/board/model/types'

export interface AssistantViewSession {
  filters: BoardFilterState
  mode: 'kanban' | 'tree'
  activeModuleId: string | null
  openItemId: string | null
}

const HISTORY_LIMIT = 20
const KEY_PREFIX = 'azy-board:view-session:'

type Listener = (session: AssistantViewSession, projectId: string) => void
const listeners = new Set<Listener>()
const appliedCommandIds = new Set<string>()
// Baseline em memória (não persiste): só o comando cria o overlay em sessionStorage.
const currentByProject = new Map<string, AssistantViewSession>()

function keyFor(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`
}

// Indica se a aba tem um overlay de sessão ativo (comando aplicado). Enquanto
// ativo, a preferência durável não deve ser regravada a partir do estado da tela.
export function hasViewSessionOverlay(projectId: string): boolean {
  try {
    return sessionStorage.getItem(keyFor(projectId)) !== null
  } catch {
    return false
  }
}

function removeRaw(projectId: string): void {
  try {
    sessionStorage.removeItem(keyFor(projectId))
  } catch {
    // Armazenamento indisponível.
  }
}

function readRaw(projectId: string): { current: AssistantViewSession; history: AssistantViewSession[] } | null {
  try {
    const raw = sessionStorage.getItem(keyFor(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { current?: AssistantViewSession; history?: AssistantViewSession[] }
    if (!parsed?.current) return null
    return { current: parsed.current, history: Array.isArray(parsed.history) ? parsed.history : [] }
  } catch {
    return null
  }
}

function writeRaw(projectId: string, current: AssistantViewSession, history: AssistantViewSession[]): void {
  try {
    sessionStorage.setItem(keyFor(projectId), JSON.stringify({ current, history: history.slice(-HISTORY_LIMIT) }))
  } catch {
    // Armazenamento indisponível: seguir sem persistir a sessão da aba.
  }
}

function notify(session: AssistantViewSession, projectId: string): void {
  for (const listener of listeners) listener(session, projectId)
}

export function defaultViewSession(): AssistantViewSession {
  return { filters: DEFAULT_FILTERS, mode: 'kanban', activeModuleId: null, openItemId: null }
}

export function subscribeViewSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// O BoardScreen publica o estado corrente para servir de baseline ao histórico.
// Não cria overlay; se já houver um ativo (comando aplicado), o mantém em sincronia
// com o estado vivo da aba, preservando o histórico.
export function syncCurrentViewSession(projectId: string, session: AssistantViewSession): void {
  currentByProject.set(projectId, session)
  const existing = readRaw(projectId)
  if (existing) writeRaw(projectId, session, existing.history)
}

function filterValueToBoardField(key: string, value: AssistantScreenFilterValue): unknown {
  if (Array.isArray(value)) return value
  if (typeof value === 'boolean') return value
  if (value && typeof value === 'object' && 'operator' in value && value.operator === 'IS_EMPTY') return EMPTY_FILTER_VALUE
  return value
}

const FILTER_KEYS = ['sprintId', 'versionId', 'moduleId', 'assigneeId', 'authorId', 'costCenterId', 'priority', 'status', 'types', 'tagIds'] as const

function filtersFromCommand(command: AssistantViewCommand): BoardFilterState {
  const next: BoardFilterState = { ...DEFAULT_FILTERS }
  for (const [key, value] of Object.entries(command.filters ?? {})) {
    if ((FILTER_KEYS as readonly string[]).includes(key)) {
      ;(next as unknown as Record<string, unknown>)[key] = filterValueToBoardField(key, value)
    }
  }
  return next
}

function applyToSession(current: AssistantViewSession, command: AssistantViewCommand): AssistantViewSession {
  if (command.type === 'set_filters') return { ...current, filters: filtersFromCommand(command) }
  if (command.type === 'clear_filters') return { ...current, filters: DEFAULT_FILTERS }
  if (command.type === 'set_view' && command.view) return { ...current, mode: command.view.mode, activeModuleId: command.view.activeModuleId }
  if (command.type === 'open_item' && command.itemId) return { ...current, openItemId: command.itemId }
  return current
}

// Recebe o comando do evento do run; deduplica por commandId e aplica na aba.
// Retorna false quando o comando é inválido e não pode ser aplicado.
export function receiveViewCommand(projectId: string, command: AssistantViewCommand): boolean {
  if (!command || command.schemaVersion !== VIEW_COMMAND_SCHEMA_VERSION) return false
  if (command.commandId && appliedCommandIds.has(command.commandId)) return true
  if (command.commandId) appliedCommandIds.add(command.commandId)
  applyViewCommand(projectId, command)
  return true
}

export function applyViewCommand(projectId: string, command: AssistantViewCommand): void {
  const stored = readRaw(projectId)
  const current = stored?.current ?? currentByProject.get(projectId) ?? defaultViewSession()
  const history = stored?.history ?? []

  if (command.type === 'restore_previous_view') {
    if (history.length === 0) return
    const restored = history[history.length - 1]
    const remaining = history.slice(0, -1)
    if (remaining.length === 0) removeRaw(projectId)
    else writeRaw(projectId, restored, remaining)
    notify(restored, projectId)
    return
  }

  const next = applyToSession(current, command)
  writeRaw(projectId, next, [...history, current])
  notify(next, projectId)
}
