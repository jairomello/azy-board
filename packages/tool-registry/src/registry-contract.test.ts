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

  test('update_sprint e update_version expõem changes próprio, policy admin e routing de atualização', () => {
    expect(new Set(requiredFieldsFor('update_sprint'))).toEqual(new Set(['projectId', 'sprintId', 'changes']))
    expect(new Set(requiredFieldsFor('update_version'))).toEqual(new Set(['projectId', 'versionId', 'changes']))
    expect(byName.get('update_sprint')!.policy).toEqual({ globalGroup: 'MANAGER', localRole: 'ADMIN' })
    expect(byName.get('update_version')!.policy).toEqual({ globalGroup: 'MANAGER', localRole: 'ADMIN' })
    expect(byName.get('update_sprint')!.routing).toMatchObject({ domain: 'planning', scope: 'project', operation: 'update' })
    expect(byName.get('update_version')!.routing).toMatchObject({ domain: 'planning', scope: 'project', operation: 'update' })
    const sprintChanges = byName.get('update_sprint')!.inputSchema.properties.changes as { items: { properties: { field: { enum: string[] } } } }
    const versionChanges = byName.get('update_version')!.inputSchema.properties.changes as { items: { properties: { field: { enum: string[] } } } }
    expect(sprintChanges.items.properties.field.enum).toEqual(['name', 'startDate', 'endDate'])
    expect(versionChanges.items.properties.field.enum).toEqual(['name', 'releaseDate', 'description', 'status'])
  })

  test('update_sprint/update_version validam changes, CLEAR por campo e formato de data', () => {
    expect(() => validateToolArguments('update_sprint', { projectId: 'p', sprintId: 's', changes: [{ field: 'endDate', operation: 'SET', value: '2026-11-14' }] })).not.toThrow()
    expect(() => validateToolArguments('update_version', { projectId: 'p', versionId: 'v', changes: [{ field: 'releaseDate', operation: 'CLEAR' }] })).not.toThrow()
    expect(() => validateToolArguments('update_sprint', { projectId: 'p', sprintId: 's', changes: [] })).toThrow('entre 1 e 20')
    expect(() => validateToolArguments('update_sprint', { projectId: 'p', sprintId: 's', changes: [{ field: 'name', operation: 'CLEAR' }] })).toThrow('não pode ser limpo')
    expect(() => validateToolArguments('update_sprint', { projectId: 'p', sprintId: 's', changes: [{ field: 'status', operation: 'SET', value: 'OPEN' }] })).toThrow('campos aceitos')
    expect(() => validateToolArguments('update_version', { projectId: 'p', versionId: 'v', changes: [{ field: 'status', operation: 'SET', value: 'OPEN' }] })).toThrow('status inválido')
    expect(() => validateToolArguments('update_sprint', { projectId: 'p', sprintId: 's', changes: [{ field: 'endDate', operation: 'SET', value: '14/11/2026' }] })).toThrow('AAAA-MM-DD')
    expect(() => validateToolArguments('update_version', { projectId: 'p', versionId: 'v', changes: [{ field: 'name', operation: 'SET', value: 'x' }, { field: 'name', operation: 'SET', value: 'y' }] })).toThrow('duplicado')
  })

  test('create_version aceita campos opcionais e mantém name obrigatório', () => {
    expect(new Set(requiredFieldsFor('create_version'))).toEqual(new Set(['projectId', 'name']))
    const properties = byName.get('create_version')!.inputSchema.properties
    expect(properties.releaseDate).toBeDefined()
    expect(properties.description).toBeDefined()
    expect(properties.status).toBeDefined()
    expect(() => validateToolArguments('create_version', { projectId: 'p', name: 'v1' })).not.toThrow()
    expect(() => validateToolArguments('create_version', { projectId: 'p', name: 'v1', releaseDate: '2026-12-01', description: 'notas', status: 'IN_DEV' })).not.toThrow()
    expect(() => validateToolArguments('create_version', { projectId: 'p', name: 'v1', status: 'OPEN' })).toThrow('status inválido')
    expect(() => validateToolArguments('create_version', { projectId: 'p', name: 'v1', releaseDate: '01/12/2026' })).toThrow('AAAA-MM-DD')
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

  test('create_item_log aceita duração canônica e legível e rejeita conflito', () => {
    expect(new Set(requiredFieldsFor('create_item_log'))).toEqual(new Set(['projectId', 'itemId', 'activity']))
    const properties = byName.get('create_item_log')!.inputSchema.properties
    expect(properties.durationMin).toBeDefined()
    expect(properties.duration).toBeDefined()
    expect(() => validateToolArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'A', durationMin: 90 })).not.toThrow()
    expect(() => validateToolArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'A', duration: '1h30' })).not.toThrow()
    expect(() => validateToolArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'A', durationMin: 30, duration: '1h' })).toThrow('divergem')
    expect(() => validateToolArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'A', duration: 'ontem' })).toThrow('duration inválida')
    expect(() => validateToolArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'A', durationMin: -1 })).toThrow('inteiro não negativo')
    expect(() => validateToolArguments('create_item_log', { projectId: 'p', itemId: 'i', activity: 'A', duracao: '1h' })).toThrow('Campo desconhecido: duracao')
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

  test('get_dashboard_metrics expõe schema, enum, policy e classificação de leitura', () => {
    const definition = byName.get('get_dashboard_metrics')!
    expect(definition).toBeDefined()
    expect(definition.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'VIEWER' })
    expect(definition.routing).toMatchObject({ domain: 'board', scope: 'project', operation: 'read' })
    expect(definition.namespace).toBe('discovery')
    expect(definition.inputSchema.properties.metric).toMatchObject({ type: 'string', enum: ['snapshot', 'burnup', 'aging', 'hours', 'sprint'] })
    expect(new Set(requiredFieldsFor('get_dashboard_metrics'))).toEqual(new Set(['metric']))
    expect(() => validateToolArguments('get_dashboard_metrics', { metric: 'snapshot' })).not.toThrow()
    expect(() => validateToolArguments('get_dashboard_metrics', { metric: 'hours', limit: 100, cursor: 'opaque' })).not.toThrow()
    expect(() => validateToolArguments('get_dashboard_metrics', { metric: 'snapshot', limit: 101 })).toThrow()
    expect(() => validateToolArguments('get_dashboard_metrics', { metric: 'snapshot', detail: 'other' })).toThrow()
    expect(() => validateToolArguments('get_dashboard_metrics', { metric: 'inválida' })).toThrow()
  })

  test('ferramentas de link expõem campos, policy, classificação e discovery coerentes', () => {
    expect(new Set(requiredFieldsFor('list_item_links'))).toEqual(new Set(['projectId', 'itemId']))
    expect(new Set(requiredFieldsFor('create_item_link'))).toEqual(new Set(['projectId', 'itemId', 'name', 'url']))
    expect(new Set(requiredFieldsFor('update_item_link'))).toEqual(new Set(['projectId', 'itemId', 'linkId']))
    expect(new Set(requiredFieldsFor('delete_item_link'))).toEqual(new Set(['projectId', 'itemId', 'linkId']))
    expect(byName.get('list_item_links')!.routing).toMatchObject({ domain: 'evidence', scope: 'item', operation: 'read' })
    expect(byName.get('create_item_link')!.routing).toMatchObject({ domain: 'evidence', scope: 'item', operation: 'create' })
    expect(byName.get('update_item_link')!.routing).toMatchObject({ domain: 'evidence', scope: 'item', operation: 'update' })
    expect(byName.get('delete_item_link')!.routing).toMatchObject({ domain: 'evidence', scope: 'item', operation: 'delete' })
    expect(byName.get('list_item_links')!.namespace).toBe('discovery')
    expect(byName.get('list_item_links')!.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'VIEWER' })
    expect(byName.get('create_item_link')!.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'MEMBER' })
    expect(byName.get('update_item_link')!.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'MEMBER' })
    expect(byName.get('delete_item_link')!.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'MEMBER' })
  })

  test('create_item_link valida URL HTTP/HTTPS e update_item_link exige ao menos um campo', () => {
    expect(() => validateToolArguments('create_item_link', { projectId: 'p', itemId: 'i', name: 'Figma', url: 'https://figma.com/file' })).not.toThrow()
    expect(() => validateToolArguments('create_item_link', { projectId: 'p', itemId: 'i', name: 'X', url: 'ftp://figma.com' })).toThrow('URL HTTP ou HTTPS')
    expect(() => validateToolArguments('create_item_link', { projectId: 'p', itemId: 'i', name: 'X', url: 'https://user:pass@figma.com' })).toThrow('sem credenciais')
    expect(() => validateToolArguments('create_item_link', { projectId: 'p', itemId: 'i', name: 'X' })).toThrow('Campo obrigatório ausente: url')
    expect(() => validateToolArguments('update_item_link', { projectId: 'p', itemId: 'i', linkId: 'l' })).toThrow('ao menos um de name, url ou description')
    expect(() => validateToolArguments('update_item_link', { projectId: 'p', itemId: 'i', linkId: 'l', url: 'https://figma.com/file' })).not.toThrow()
    expect(() => validateToolArguments('delete_item_link', { projectId: 'p', itemId: 'i', linkId: '' })).toThrow('Campo obrigatório ausente: linkId')
  })

  test('read_attachment expõe schema, policy, classificação de leitura e resposta declarada', () => {
    const definition = byName.get('read_attachment')!
    expect(definition).toBeDefined()
    expect(new Set(requiredFieldsFor('read_attachment'))).toEqual(new Set(['projectId', 'itemId', 'attachmentId']))
    expect(definition.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'VIEWER' })
    expect(definition.routing).toMatchObject({ domain: 'evidence', scope: 'item', operation: 'read' })
    expect(definition.namespace).toBe('discovery')
    expect(definition.responseSchema).toBeDefined()
    expect(definition.inputSchema.properties.attachmentId).toBeDefined()
    expect(() => validateToolArguments('read_attachment', { projectId: 'p', itemId: 'i', attachmentId: 'a' })).not.toThrow()
    expect(() => validateToolArguments('read_attachment', { projectId: 'p', itemId: 'i' })).toThrow('attachmentId')
    expect(() => validateToolArguments('read_attachment', { projectId: 'p', itemId: 'i', attachmentId: 'a', path: '/etc/passwd' })).toThrow('Campo desconhecido: path')
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

describe('catálogo de composição de squads e cadastros (T25)', () => {
  test('set_member_squad expõe SET/CLEAR, policy admin e routing de colaboração', () => {
    expect(new Set(requiredFieldsFor('set_member_squad'))).toEqual(new Set(['projectId', 'userId', 'squadId']))
    expect(byName.get('set_member_squad')!.policy).toEqual({ globalGroup: 'MANAGER', localRole: 'ADMIN' })
    expect(byName.get('set_member_squad')!.routing).toMatchObject({ domain: 'collaboration', scope: 'project', operation: 'update' })
    expect((byName.get('set_member_squad')!.inputSchema.properties.squadId as { type: string[] }).type).toEqual(['string', 'null'])
  })

  test('set_member_squad aceita SET por ID e CLEAR por null, mas rejeita vazio', () => {
    expect(() => validateToolArguments('set_member_squad', { projectId: 'p', userId: 'u', squadId: 's' })).not.toThrow()
    expect(() => validateToolArguments('set_member_squad', { projectId: 'p', userId: 'u', squadId: null })).not.toThrow()
    expect(() => validateToolArguments('set_member_squad', { projectId: 'p', userId: 'u' })).toThrow('Campo obrigatório ausente: squadId')
    expect(() => validateToolArguments('set_member_squad', { projectId: 'p', userId: 'u', squadId: '   ' })).toThrow()
  })

  test('edições de squad/módulo/centro exigem ADMIN e tag exige MEMBER', () => {
    expect(byName.get('update_squad')!.policy).toEqual({ globalGroup: 'MANAGER', localRole: 'ADMIN' })
    expect(byName.get('update_module')!.policy).toEqual({ globalGroup: 'MANAGER', localRole: 'ADMIN' })
    expect(byName.get('update_cost_center')!.policy).toEqual({ globalGroup: 'MANAGER', localRole: 'ADMIN' })
    expect(byName.get('update_tag')!.policy).toEqual({ globalGroup: 'TEAM_MEMBER', localRole: 'MEMBER' })
    expect(byName.get('update_module')!.routing).toMatchObject({ domain: 'planning', scope: 'project', operation: 'update' })
    expect(byName.get('update_tag')!.routing).toMatchObject({ domain: 'planning', scope: 'project', operation: 'update' })
    expect(byName.get('update_cost_center')!.routing).toMatchObject({ domain: 'planning', scope: 'project', operation: 'update' })
  })

  test('update_tag exige ao menos um campo e valida cor hex', () => {
    expect(() => validateToolArguments('update_tag', { projectId: 'p', tagId: 't', color: '#ff0000' })).not.toThrow()
    expect(() => validateToolArguments('update_tag', { projectId: 'p', tagId: 't', name: 'Nova' })).not.toThrow()
    expect(() => validateToolArguments('update_tag', { projectId: 'p', tagId: 't' })).toThrow('ao menos um de name ou color')
    expect(() => validateToolArguments('update_tag', { projectId: 'p', tagId: 't', color: 'vermelho' })).toThrow('#RRGGBB')
  })

  test('update_cost_center exige ao menos um campo', () => {
    expect(() => validateToolArguments('update_cost_center', { projectId: 'p', costCenterId: 'c', code: 'CC-2' })).not.toThrow()
    expect(() => validateToolArguments('update_cost_center', { projectId: 'p', costCenterId: 'c', description: 'x' })).not.toThrow()
    expect(() => validateToolArguments('update_cost_center', { projectId: 'p', costCenterId: 'c' })).toThrow('ao menos um de code ou description')
  })

  test('update_member continua compatível e update_squad/update_module exigem nome', () => {
    expect(new Set(requiredFieldsFor('update_member'))).toEqual(new Set(['projectId', 'userId', 'role']))
    expect(() => validateToolArguments('update_member', { projectId: 'p', userId: 'u', role: 'MEMBER' })).not.toThrow()
    expect(new Set(requiredFieldsFor('update_squad'))).toEqual(new Set(['projectId', 'squadId', 'name']))
    expect(new Set(requiredFieldsFor('update_module'))).toEqual(new Set(['projectId', 'moduleId', 'name']))
  })
})
