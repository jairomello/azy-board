// Card T17 — catálogo do assistente para comandos de interface. Estas ferramentas
// vivem apenas no agente (não entram em SHARED_TOOL_NAMES e, portanto, não são
// expostas no catálogo MCP). São somente-leitura: não mutam dados e não exigem
// aprovação. O harness intercepta os nomes antes de executeTool e entrega o
// comando normalizado no evento TOOL_COMPLETED.
import { randomUUID } from 'node:crypto'
import { VIEW_COMMAND_SCHEMA_VERSION } from '@azy-board/assistant-contracts'
import type { AssistantScreenFilterValue, AssistantViewCommand } from '@azy-board/assistant-contracts'
import type { ModelTool } from './openaiProvider'

type UiContext = { projectId?: string; targetProjectId?: string }

// Filtros aceitos pelo comando, mapeados para os campos do estado do board.
const SCALAR_FILTERS: Record<string, string> = {
  sprint: 'sprintId',
  version: 'versionId',
  module: 'moduleId',
  assignee: 'assigneeId',
  author: 'authorId',
  costCenter: 'costCenterId',
  priority: 'priority',
  status: 'status',
}
const ARRAY_FILTERS: Record<string, string> = { types: 'types', tag: 'tagIds' }
const EMPTY_OPERATOR = 'IS_EMPTY'

function nullable(schema: Record<string, unknown>): Record<string, unknown> {
  return { ...schema, type: [schema.type, 'null'] }
}

function strictTool(name: string, description: string, properties: Record<string, unknown>): ModelTool {
  return {
    type: 'function',
    name,
    description,
    parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
    strict: true,
  }
}

const filterProperties: Record<string, unknown> = Object.fromEntries([
  ...Object.keys(SCALAR_FILTERS).map(key => [key, nullable({ type: 'string', description: `Valor exato, ou ${EMPTY_OPERATOR} para itens sem valor.` })]),
  ['types', nullable({ type: 'array', items: { type: 'string', enum: ['EPIC', 'STORY', 'TASK', 'BUG'] } })],
  ['tag', nullable({ type: 'array', items: { type: 'string' } })],
])

export const UI_TOOL_NAMES = ['set_board_filters', 'clear_board_filters', 'set_board_view', 'open_item', 'reveal_item', 'explain_item_visibility', 'open_planning_result', 'restore_previous_view'] as const
const UI_TOOL_SET: ReadonlySet<string> = new Set(UI_TOOL_NAMES)

export function isUiTool(name: string): boolean {
  return UI_TOOL_SET.has(name)
}

// Card T18 — ferramentas que exigem resolução server-side (explicação/revelação)
// e não são comandos de visão puros.
export function isVisibilityTool(name: string): boolean {
  return name === 'explain_item_visibility' || name === 'reveal_item'
}

// Card T26 — resolve a população fixada do resultado no servidor antes de
// entregar o comando; o cliente nunca reconstrói o recorte a partir de filtros.
export function isPlanningResultTool(name: string): boolean {
  return name === 'open_planning_result'
}

export type PlanningResultResolution =
  | { ok: true; command: AssistantViewCommand }
  | { ok: false; code: 'RESULT_NOT_FOUND' | 'RESULT_EXPIRED' | 'ITEM_NOT_ACCESSIBLE' }

export function getUiToolModels(): ModelTool[] {
  return [
    strictTool('set_board_filters', 'Aplica filtros reais no board do projeto atual (substitui o conjunto vigente). Use IS_EMPTY para itens sem valor.', filterProperties),
    strictTool('clear_board_filters', 'Limpa todos os filtros aplicados no board do projeto atual.', {}),
    strictTool('set_board_view', 'Alterna a visualização do board entre Kanban e árvore e define o módulo ativo.', {
      mode: { type: 'string', enum: ['kanban', 'tree'], description: 'Modo de visualização.' },
      activeModuleId: nullable({ type: 'string', description: 'Módulo ativo (opcional).' }),
    }),
    strictTool('open_item', 'Abre a modal do card indicado no projeto atual.', {
      itemId: { type: 'string', description: 'ID do item a abrir.' },
    }),
    strictTool('reveal_item', 'Mostra um card que não aparece no board, neutralizando os motivos responsáveis e preservando a visão anterior. Use após explain_item_visibility.', {
      itemId: { type: 'string', description: 'ID do item a revelar.' },
    }),
    strictTool('explain_item_visibility', 'Explica por que um card não aparece no board atual (filtros, módulo, grupo recolhido, regra de subtarefas, grupo vazio ou arquivamento). Somente leitura.', {
      itemId: nullable({ type: 'string', description: 'ID do item (opcional se sequenceCode informado).' }),
      sequenceCode: nullable({ type: 'string', description: 'Código amigável do item (ex.: T42).' }),
    }),
    strictTool('open_planning_result', 'Abre no board a população exata de um resultado de query_planning_gaps (inclusive condições OR e lacunas que o toolbar não representa). Use o resultId retornado pela consulta; opcionalmente foque um grupo. Somente leitura, preserva a visão anterior.', {
      resultId: { type: 'string', description: 'ID do resultado retornado por query_planning_gaps.' },
      group: nullable({ type: 'string', enum: ['dueDate', 'points', 'sprint', 'version', 'assignee'], description: 'Grupo de lacuna a focar (opcional).' }),
    }),
    strictTool('restore_previous_view', 'Volta à visão anterior do board (filtros, modo, módulo e item aberto).', {}),
  ]
}

function normalizeScalar(value: unknown): AssistantScreenFilterValue {
  if (value === EMPTY_OPERATOR) return { operator: 'IS_EMPTY' }
  return value as string
}

export function normalizeUiCommand(name: string, args: Record<string, unknown>, context: UiContext): AssistantViewCommand {
  const projectId = context.targetProjectId ?? context.projectId
  if (!projectId) throw new Error('USER_CONTEXT_REQUIRED: selecione um projeto antes de controlar a visualização')
  const base = { schemaVersion: VIEW_COMMAND_SCHEMA_VERSION, commandId: randomUUID() } as const

  if (name === 'set_board_filters') {
    const filters: Record<string, AssistantScreenFilterValue> = {}
    for (const [inputKey, targetKey] of Object.entries(SCALAR_FILTERS)) {
      const value = args[inputKey]
      if (typeof value === 'string' && value.trim() !== '') filters[targetKey] = normalizeScalar(value)
    }
    for (const [inputKey, targetKey] of Object.entries(ARRAY_FILTERS)) {
      const value = args[inputKey]
      if (Array.isArray(value) && value.length > 0) filters[targetKey] = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    }
    return { ...base, type: 'set_filters', filters }
  }
  if (name === 'clear_board_filters') return { ...base, type: 'clear_filters' }
  if (name === 'set_board_view') {
    const mode = args.mode
    if (mode !== 'kanban' && mode !== 'tree') throw new Error('VALIDATION_ERROR: modo de visualização inválido')
    const activeModuleId = typeof args.activeModuleId === 'string' && args.activeModuleId.trim() !== '' ? args.activeModuleId : null
    return { ...base, type: 'set_view', view: { mode, activeModuleId } }
  }
  if (name === 'open_item') {
    const itemId = args.itemId
    if (typeof itemId !== 'string' || itemId.trim() === '') throw new Error('VALIDATION_ERROR: itemId é obrigatório')
    return { ...base, type: 'open_item', itemId }
  }
  if (name === 'restore_previous_view') return { ...base, type: 'restore_previous_view' }
  throw new Error(`VALIDATION_ERROR: comando de interface desconhecido (${name})`)
}
