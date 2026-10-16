import { describe, expect, test } from 'bun:test'
import { getSharedToolDefinitions } from './registry.js'
import { validateToolArguments } from './validation.js'

// create_task.status deve validar como enum e falhar de forma acionável,
// em paridade com update_item (que já acusava "status inválido; valores aceitos").
const createTask = getSharedToolDefinitions(['create_task'])[0]!

describe('validação de status em create_task', () => {
  test('status textual (nome de coluna) é rejeitado com a lista de valores aceitos', () => {
    expect(() => validateToolArguments('create_task', { projectId: 'p', title: 'Card', status: 'A Fazer' }))
      .toThrow(/status inválido; valores aceitos: NOT_STARTED, IN_PROGRESS, BLOCKED, DONE, CANCELLED/)
  })

  test('status válido é aceito', () => {
    expect(() => validateToolArguments('create_task', { projectId: 'p', title: 'Card', status: 'NOT_STARTED' })).not.toThrow()
  })

  test('status omitido continua válido', () => {
    expect(() => validateToolArguments('create_task', { projectId: 'p', title: 'Card' })).not.toThrow()
  })

  test('o schema exposto declara o enum de status', () => {
    const status = createTask.inputSchema.properties.status as { enum?: unknown[] }
    expect(status.enum).toEqual(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED', null])
  })
})
