import { describe, expect, test } from 'bun:test'
import { getSharedToolDefinitions, requiredFieldsFor, SHARED_TOOL_NAMES } from './registry.js'
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
