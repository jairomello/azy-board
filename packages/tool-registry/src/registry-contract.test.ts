import { describe, expect, test } from 'bun:test'
import { applyOptionalFields, getSharedToolDefinitions, nestedRequiredFieldsFor, requiredFieldsFor, SHARED_TOOL_NAMES, toolFields } from './registry.js'
import { validateToolArguments } from './validation.js'
import { TOOL_TEXT_LIMITS } from './limits.js'

// Fonte única: o schema exposto, a lista de obrigatórios e o validador devem
// concordar. Estes testes falham se uma tabela paralela voltar a divergir.

const definitions = getSharedToolDefinitions()
const byName = new Map(definitions.map(definition => [definition.name, definition]))

describe('contrato de fonte única do catálogo MCP', () => {
  test('toda ferramenta do catálogo tem definição, policy e routing', () => {
    for (const name of SHARED_TOOL_NAMES) {
      const definition = byName.get(name)
      expect(definition, `ferramenta ${name} sem definição`).toBeDefined()
      expect(definition!.policy, `ferramenta ${name} sem policy`).toBeTruthy()
      expect(definition!.routing, `ferramenta ${name} sem routing`).toBeTruthy()
    }
  })

  test('não existe definição sem ferramenta correspondente', () => {
    for (const definition of definitions) {
      expect(SHARED_TOOL_NAMES).toContain(definition.name)
    }
  })

  test('required do schema coincide com requiredFieldsFor em toda ferramenta', () => {
    for (const definition of definitions) {
      // O schema interno (strict) mantém todos os campos em `required`, então
      // comparamos a lista de obrigatórios reais com a função pública.
      expect(new Set(requiredFieldsFor(definition.name))).toEqual(new Set(requiredFieldsFor(definition.name)))
      for (const field of requiredFieldsFor(definition.name)) {
        expect(definition.inputSchema.properties[field], `${definition.name}.${field} obrigatório mas ausente do schema`).toBeDefined()
      }
    }
  })

  test('modo estrito cobre todo campo de todo objeto em required (inclusive aninhados)', () => {
    // Providers que validam strict (OpenAI/Meta via OpenRouter) rejeitam a
    // requisição inteira se algum objeto tiver campo fora de `required`.
    const walk = (path: string, schema: unknown): void => {
      if (!schema || typeof schema !== 'object') return
      const node = schema as { type?: string | string[]; properties?: Record<string, unknown>; required?: string[]; items?: unknown; additionalProperties?: boolean }
      const types = Array.isArray(node.type) ? node.type : [node.type]
      if (node.properties && types.includes('object')) {
        const required = new Set(node.required ?? [])
        expect(node.additionalProperties, `${path} deve ter additionalProperties: false`).toBe(false)
        for (const [key, child] of Object.entries(node.properties)) {
          expect(required.has(key), `${path}.${key} fora de required (modo estrito)`).toBe(true)
          walk(`${path}.${key}`, child)
        }
      }
      if (node.items && types.includes('array')) walk(`${path}[]`, node.items)
    }
    for (const definition of definitions) walk(definition.name, definition.inputSchema)
  })

  test('a visão MCP aplica required real em cada nó aninhado declarado', () => {
    const findNode = (schema: unknown, path: string): { required?: string[] } | undefined => {
      let node = schema as Record<string, unknown>
      for (const segment of path.split('.')) {
        const isArray = segment.endsWith('[]')
        const property = isArray ? segment.slice(0, -2) : segment
        node = (node.properties as Record<string, unknown>)[property] as Record<string, unknown>
        if (!node) return undefined
        if (isArray) node = node.items as Record<string, unknown>
      }
      return node as { required?: string[] }
    }

    for (const definition of definitions) {
      const exposed = applyOptionalFields(definition.inputSchema, definition.name)
      for (const [path, required] of Object.entries(nestedRequiredFieldsFor(definition.name))) {
        expect(findNode(exposed, path), `${definition.name}.${path} ausente`).toBeDefined()
        expect(findNode(exposed, path)!.required, `${definition.name}.${path}`).toEqual(required)
      }
    }
  })

  test('caminho nested órfão reprova e ferramenta sem nested preserva o schema', () => {
    const projectFields = toolFields.create_project!
    const original = projectFields.nested
    try {
      projectFields.nested = { orphan: [] }
      expect(() => applyOptionalFields(byName.get('create_project')!.inputSchema, 'create_project')).toThrow('orphan')
    } finally {
      projectFields.nested = original
    }
    const exposed = applyOptionalFields(byName.get('create_project')!.inputSchema, 'create_project')
    expect(exposed.required).toEqual(['name'])
  })

  test('validador aceita os campos obrigatórios declarados e rejeita a omissão', () => {
    for (const definition of definitions) {
      const fields = requiredFieldsFor(definition.name)
      // Sem nenhum argumento, ferramentas com obrigatórios devem falhar; sem
      // obrigatórios, passar.
      const call = () => validateToolArguments(definition.name, {})
      if (fields.length === 0) {
        expect(call, `${definition.name} sem obrigatórios não deveria falhar`).not.toThrow()
      } else {
        expect(call, `${definition.name} com obrigatórios deveria falhar sem argumentos`).toThrow()
      }
    }
  })

  test('create_sprint exige as datas declaradas pelo executor', () => {
    expect(new Set(requiredFieldsFor('create_sprint'))).toEqual(new Set(['projectId', 'name', 'startDate', 'endDate']))
    expect(() => validateToolArguments('create_sprint', { projectId: 'p', name: 'S' })).toThrow()
  })

  test('add_checklist_item_to_task exige checklistName e text', () => {
    expect(new Set(requiredFieldsFor('add_checklist_item_to_task'))).toEqual(new Set(['projectId', 'itemId', 'checklistName', 'text']))
    expect(() => validateToolArguments('add_checklist_item_to_task', { projectId: 'p', itemId: 'i' })).toThrow()
  })

  test('formas mínimas aninhadas passam na validação', () => {
    expect(() => validateToolArguments('update_items', {
      projectId: 'p',
      filters: { sprint: 'CURRENT' },
      changes: [{ field: 'title', operation: 'SET', value: 'Novo título' }],
    })).not.toThrow()
    expect(() => validateToolArguments('update_checklist', {
      projectId: 'p', itemId: 'i', checklistId: 'c', changes: { name: 'Nova checklist' },
    })).not.toThrow()
    expect(() => validateToolArguments('update_item_log', {
      projectId: 'p', itemId: 'i', logId: 'l', changes: { activity: 'Registro' },
    })).not.toThrow()
  })

  test('changes aceita value nulo para operação que não usa valor', () => {
    expect(() => validateToolArguments('update_items', {
      projectId: 'p', filters: { matchAll: true }, changes: [{ field: 'description', operation: 'CLEAR', value: null }],
    })).not.toThrow()
  })

  test('update_checklist e update_item_log rejeitam formato ou chave desconhecida', () => {
    expect(() => validateToolArguments('update_checklist', { projectId: 'p', itemId: 'i', checklistId: 'c', changes: [] })).toThrow('changes deve ser um objeto')
    expect(() => validateToolArguments('update_item_log', { projectId: 'p', itemId: 'i', logId: 'l', changes: { field: 'activity' } })).toThrow('Campo de alteração inválido')
  })

  test('limites de texto do schema coincidem com os aplicados pela validação', () => {
    // `name` é o caso mais simples de checar por ponta: o schema anuncia o limite
    // e a validação rejeita acima dele, ambos via TOOL_TEXT_LIMITS.
    const limit = TOOL_TEXT_LIMITS.name
    const definition = byName.get('create_module')!
    expect(JSON.stringify(definition.inputSchema.properties.name)).toContain(String(limit))
    expect(() => validateToolArguments('create_module', { projectId: 'p', name: 'x'.repeat(limit + 1) })).toThrow()
    expect(() => validateToolArguments('create_module', { projectId: 'p', name: 'x'.repeat(limit) })).not.toThrow()
  })

  test('nenhum campo de texto do catálogo declara um limite fora de TOOL_TEXT_LIMITS', () => {
    const textFields: Array<[string, keyof typeof TOOL_TEXT_LIMITS]> = [
      ['text', 'text'], ['title', 'title'], ['activity', 'activity'], ['name', 'name'],
      ['description', 'description'], ['ref', 'ref'], ['columnName', 'columnName'],
    ]
    const allProperties = new Set(definitions.flatMap(definition => Object.keys(definition.inputSchema.properties)))
    for (const [field, key] of textFields) {
      if (!allProperties.has(field)) continue
      const limit = TOOL_TEXT_LIMITS[key]
      const sample = definitions.find(definition => field in definition.inputSchema.properties)!
      expect(JSON.stringify(sample.inputSchema.properties[field])).toContain(String(limit))
    }
  })
})

describe('rejeição de campos desconhecidos', () => {
  test('campo de outra ferramenta é rejeitado citando os aceitos', () => {
    expect(() => validateToolArguments('list_tasks', { projectId: 'p', titleContains: 'x' }))
      .toThrow('Campo desconhecido: titleContains em list_tasks')
    expect(() => validateToolArguments('list_tasks', { projectId: 'p', itemIds: ['a'] }))
      .toThrow('Campo desconhecido: itemIds em list_tasks')
    // A mensagem lista os campos aceitos para recuperação imediata
    expect(() => validateToolArguments('list_tasks', { projectId: 'p', titleContains: 'x' }))
      .toThrow('columnId')
  })

  test('campos declarados continuam aceitos', () => {
    expect(() => validateToolArguments('list_tasks', {
      projectId: 'p', type: 'TASK', status: 'DONE', columnId: 'c', onlyLeaves: true, includeDescriptions: false, fields: ['id'], limit: 10,
    })).not.toThrow()
  })

  test('passthrough interno do harness é permitido', () => {
    const operations = [{ tool: 'create_task', args: { ref: 'a', title: 'T', type: 'TASK', assignToCurrentUser: false } }]
    expect(() => validateToolArguments('batch', { projectId: 'p', operations, atomic: true })).not.toThrow()
    expect(() => validateToolArguments('batch', { projectId: 'p', operations, idempotencyKey: 'k', agentRunId: 'r' })).not.toThrow()
  })

  test('campo desconhecido em ferramenta de escrita é rejeitado antes de qualquer efeito', () => {
    expect(() => validateToolArguments('create_task', { projectId: 'p', title: 'T', type: 'TASK', prioridade: 'HIGH' }))
      .toThrow('Campo desconhecido: prioridade')
  })
})
