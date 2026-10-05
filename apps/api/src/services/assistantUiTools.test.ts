import { describe, expect, test } from 'bun:test'
import { SHARED_TOOL_NAMES } from '@azy-board/tool-registry'
import { getUiToolModels, isUiTool, isVisibilityTool, normalizeUiCommand, UI_TOOL_NAMES } from './assistantUiTools'

const context = { projectId: 'proj-1' }

describe('assistantUiTools (card T17)', () => {
  test('as ferramentas de UI não fazem parte do catálogo compartilhado (MCP)', () => {
    for (const name of UI_TOOL_NAMES) {
      expect(isUiTool(name)).toBe(true)
      expect((SHARED_TOOL_NAMES as readonly string[]).includes(name)).toBe(false)
    }
  })

  test('cada ferramenta de UI tem schema strict com todos os campos requeridos', () => {
    const models = getUiToolModels()
    expect(models.map(model => model.name)).toEqual([...UI_TOOL_NAMES])
    for (const model of models) {
      const parameters = model.parameters as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean }
      expect(parameters.additionalProperties).toBe(false)
      expect(parameters.required).toEqual(Object.keys(parameters.properties))
    }
  })

  test('set_board_filters normaliza ausência por operador e arrays', () => {
    const command = normalizeUiCommand('set_board_filters', { sprint: 'IS_EMPTY', version: 'v1', types: ['BUG'], tag: ['t1'] }, context)
    expect(command.type).toBe('set_filters')
    expect(command.filters).toEqual({
      sprintId: { operator: 'IS_EMPTY' },
      versionId: 'v1',
      types: ['BUG'],
      tagIds: ['t1'],
    })
  })

  test('set_board_filters ignora valores vazios', () => {
    const command = normalizeUiCommand('set_board_filters', { sprint: '', version: null, priority: 'HIGH' }, context)
    expect(command.filters).toEqual({ priority: 'HIGH' })
  })

  test('set_board_view aceita kanban/árvore e valida o modo', () => {
    expect(normalizeUiCommand('set_board_view', { mode: 'tree', activeModuleId: 'm1' }, context).view).toEqual({ mode: 'tree', activeModuleId: 'm1' })
    expect(normalizeUiCommand('set_board_view', { mode: 'kanban', activeModuleId: null }, context).view).toEqual({ mode: 'kanban', activeModuleId: null })
    expect(() => normalizeUiCommand('set_board_view', { mode: 'matrix' }, context)).toThrow(/VALIDATION_ERROR/)
  })

  test('open_item exige itemId', () => {
    expect(normalizeUiCommand('open_item', { itemId: 'i1' }, context).itemId).toBe('i1')
    expect(() => normalizeUiCommand('open_item', { itemId: '  ' }, context)).toThrow(/VALIDATION_ERROR/)
  })

  test('comandos sem projeto no contexto são recusados', () => {
    expect(() => normalizeUiCommand('restore_previous_view', {}, {})).toThrow(/USER_CONTEXT_REQUIRED/)
  })

  test('limpar e voltar produzem os tipos corretos', () => {
    expect(normalizeUiCommand('clear_board_filters', {}, context).type).toBe('clear_filters')
    expect(normalizeUiCommand('restore_previous_view', {}, context).type).toBe('restore_previous_view')
  })
})

describe('assistantUiTools — explicação de visibilidade (card T18)', () => {
  test('explicação e revelação são ferramentas de visibilidade e não estão no MCP', () => {
    expect(isVisibilityTool('explain_item_visibility')).toBe(true)
    expect(isVisibilityTool('reveal_item')).toBe(true)
    expect(isVisibilityTool('open_item')).toBe(false)
    for (const name of ['explain_item_visibility', 'reveal_item']) {
      expect((SHARED_TOOL_NAMES as readonly string[]).includes(name)).toBe(false)
    }
  })

  test('explain_item_visibility aceita itemId ou sequenceCode', () => {
    const model = getUiToolModels().find(item => item.name === 'explain_item_visibility')
    expect(model).toBeDefined()
    const properties = (model!.parameters as { properties: Record<string, unknown> }).properties
    expect(Object.keys(properties)).toEqual(['itemId', 'sequenceCode'])
  })

  test('reveal_item exige itemId no schema', () => {
    const model = getUiToolModels().find(item => item.name === 'reveal_item')
    expect(model).toBeDefined()
    const parameters = model!.parameters as { required: string[]; properties: Record<string, unknown> }
    expect(parameters.required).toEqual(['itemId'])
  })
})
