export function assertNonEmptyString(value: unknown, field: string, maxLength = 200): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} deve ser uma string não vazia`)
  }
  if (value.trim().length > maxLength) {
    throw new Error(`${field} excede o limite de ${maxLength} caracteres`)
  }
}

export function assertEnum(value: unknown, field: string, values: readonly string[]): void {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${field} inválido; valores aceitos: ${values.join(', ')}`)
  }
}

export function assertStringArray(value: unknown, field: string, maxLength = 100): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maxLength || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${field} deve ser uma lista de até ${maxLength} strings não vazias`)
  }
}

export function assertNonNegativeNumber(value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} deve ser um número não negativo`)
  }
}

export function assertIsoDate(value: unknown, field: string): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} deve ser uma data ISO válida`)
  }
}

export function validateToolArguments(name: string, args: Record<string, unknown> | undefined): void {
  const requiredByTool: Record<string, string[]> = {
    list_projects: [], get_project: ['projectId'], get_board: ['projectId'], get_tree: ['projectId'], get_shadow_markdown: ['projectId'],
    list_tasks: ['projectId'], list_modules: ['projectId'], get_current_sprint: ['projectId'], list_columns: ['projectId'], list_sprints: ['projectId'], list_tags: ['projectId'], list_versions: ['projectId'], list_members: ['projectId'], list_squads: ['projectId'], list_item_logs: ['projectId', 'itemId'], list_cost_centers: ['projectId'], list_attachments: ['projectId', 'itemId'], list_checklists: ['projectId', 'itemId'],
    claim_task: ['projectId', 'taskId'], move_task: ['projectId', 'taskId', 'columnName'], complete_task: ['projectId', 'taskId'], create_task: ['projectId', 'title'], create_checklist: ['projectId', 'itemId', 'name'], add_checklist_item: ['projectId', 'itemId', 'checklistId', 'text'], check_item: ['projectId', 'itemId', 'checklistId', 'checklistItemId', 'checked'], update_item: ['projectId', 'itemId', 'changes'], update_items: ['projectId', 'filters', 'changes'], release_task: ['projectId', 'taskId'], delete_item: ['projectId', 'itemId'], delete_project: ['projectId'], archive_item: ['projectId', 'itemId'], unarchive_item: ['projectId', 'itemId'], set_item_tags: ['projectId', 'itemId', 'tagIds'], create_item_log: ['projectId', 'itemId', 'activity'], reorder_items: ['projectId', 'columnId', 'order'], update_checklist: ['projectId', 'itemId', 'checklistId', 'changes'], delete_checklist: ['projectId', 'itemId', 'checklistId'], update_checklist_item: ['projectId', 'itemId', 'checklistId', 'checklistItemId', 'changes'], delete_checklist_item: ['projectId', 'itemId', 'checklistId', 'checklistItemId'], update_item_log: ['projectId', 'itemId', 'logId', 'changes'], batch: ['projectId', 'operations'],
    create_project: ['name'], create_project_structure: ['name', 'operations'], update_project: ['projectId'], create_module: ['projectId', 'name'], create_column: ['projectId', 'name', 'baseStatus'], reorder_columns: ['projectId', 'order'], create_sprint: ['projectId', 'name', 'startDate', 'endDate'], activate_sprint: ['projectId', 'sprintId'], close_sprint: ['projectId', 'sprintId'], create_tag: ['projectId', 'name'], create_version: ['projectId', 'name'], add_member: ['projectId', 'email', 'role'], update_member: ['projectId', 'userId', 'role'], remove_member: ['projectId', 'userId'], create_squad: ['projectId', 'name'], create_cost_center: ['projectId', 'code'],
  }
  const required = requiredByTool[name]
  if (!required) throw new Error(`Ferramenta desconhecida: ${name}`)
  for (const field of required) {
    const value = args?.[field]
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) throw new Error(`Campo obrigatório ausente: ${field}`)
  }
  const input = args ?? {}
  for (const field of ['projectId', 'itemId', 'taskId', 'sprintId', 'tagId', 'versionId', 'userId', 'columnId', 'moduleId', 'checklistId', 'checklistItemId']) if (field in input && input[field] !== undefined) assertNonEmptyString(input[field], field, 128)
  for (const field of ['name', 'title', 'description', 'activity', 'text']) if (field in input && input[field] !== undefined) assertNonEmptyString(input[field], field)
  if ('tagIds' in input) assertStringArray(input.tagIds, 'tagIds')
  if ('order' in input) assertStringArray(input.order, 'order')
  if ('durationMin' in input && input.durationMin !== undefined && input.durationMin !== null) assertNonNegativeNumber(input.durationMin, 'durationMin')
  if ('limit' in input && input.limit !== undefined && (typeof input.limit !== 'number' || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) throw new Error('limit deve ser um inteiro entre 1 e 100')
  if ((name === 'update_item' || name === 'update_items')) {
    if (!Array.isArray(input.changes) || input.changes.length < 1 || input.changes.length > 20) throw new Error('changes deve conter entre 1 e 20 alterações')
    const fields = new Set<string>()
    const dateFields = new Set(['startDate', 'dueDate'])
    const clearableFields = new Set(['description', 'points', 'assignee', 'column', 'module', 'startDate', 'dueDate', 'blockedReason', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'version', 'costCenter', 'sprint'])
    const allowedFields = new Set(['title', 'description', 'priority', 'type', 'status', 'points', 'assignee', 'column', 'parent', 'module', 'startDate', 'dueDate', 'blockedReason', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'version', 'costCenter', 'sprint'])
    for (const raw of input.changes as Array<Record<string, unknown>>) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.field !== 'string' || !allowedFields.has(raw.field)) throw new Error('Campo de alteração inválido')
      if (fields.has(raw.field)) throw new Error(`Campo duplicado em changes: ${raw.field}`)
      fields.add(raw.field)
      if (!['SET', 'CLEAR', 'TODAY', 'OFFSET_DAYS', 'COPY_CREATED_DATE'].includes(String(raw.operation))) throw new Error(`Operação inválida para ${raw.field}`)
      if (raw.operation === 'SET' && (typeof raw.value !== 'string' || !raw.value.trim())) throw new Error(`Valor obrigatório para ${raw.field}`)
      if (raw.operation === 'CLEAR' && !clearableFields.has(raw.field)) throw new Error(`${raw.field} não pode ser limpo`)
      if (['TODAY', 'OFFSET_DAYS', 'COPY_CREATED_DATE'].includes(String(raw.operation)) && !dateFields.has(raw.field)) throw new Error(`${raw.operation} só pode ser usado em datas`)
      if (raw.operation === 'OFFSET_DAYS' && (typeof raw.value !== 'string' || !/^-?\d+$/.test(raw.value) || Math.abs(Number(raw.value)) > 36_500)) throw new Error(`Deslocamento inválido para ${raw.field}`)
      if (raw.field === 'priority' && raw.operation === 'SET') assertEnum(raw.value, 'priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      if (raw.field === 'type' && raw.operation === 'SET') assertEnum(raw.value, 'type', ['TASK', 'BUG'])
      if (raw.field === 'status' && raw.operation === 'SET') assertEnum(raw.value, 'status', ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])
      if (raw.field === 'points' && raw.operation === 'SET' && (typeof raw.value !== 'string' || !/^\d+$/.test(raw.value))) throw new Error('points deve ser um inteiro não negativo')
    }
  } else if ('changes' in input && (typeof input.changes !== 'object' || input.changes === null || Array.isArray(input.changes))) throw new Error('changes deve ser um objeto')
  if (name === 'update_items') {
    const filters = input.filters
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw new Error('filters deve ser um objeto')
    const value = filters as Record<string, unknown>
    const hasFilter = ['itemIds', 'types', 'statuses', 'sprint', 'version', 'module', 'assignee', 'parent', 'column', 'tag', 'titleContains', 'onlyLeaves'].some(field => value[field] !== null && value[field] !== undefined)
    if (!hasFilter && value.matchAll !== true) throw new Error('Informe filtros ou confirme matchAll')
    if (value.itemIds !== null && value.itemIds !== undefined) assertStringArray(value.itemIds, 'itemIds', 500)
    if (value.types !== null && value.types !== undefined) {
      assertStringArray(value.types, 'types', 4)
      for (const type of value.types) assertEnum(type, 'type', ['EPIC', 'STORY', 'TASK', 'BUG'])
    }
    if (value.statuses !== null && value.statuses !== undefined) {
      assertStringArray(value.statuses, 'statuses', 5)
      for (const status of value.statuses) assertEnum(status, 'status', ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])
    }
  }
  if (name === 'batch' || name === 'create_project_structure') {
    if (!Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 50) throw new Error('operations deve conter entre 1 e 50 entradas')
    const refs = new Set<string>()
    const typesByRef = new Map<string, string>()
    for (const operation of input.operations as Array<{ tool?: unknown; args?: Record<string, unknown> }>) {
      if (operation.tool !== 'create_task' || !operation.args) throw new Error('Operação de lote inválida')
      assertNonEmptyString(operation.args.ref, 'ref', 100)
      assertNonEmptyString(operation.args.title, 'title')
      assertEnum(operation.args.type, 'type', ['EPIC', 'STORY', 'TASK', 'BUG'])
      if (typeof operation.args.assignToCurrentUser !== 'boolean') throw new Error('assignToCurrentUser deve ser booleano')
      const type = operation.args.type as string
      const parentRef = typeof operation.args.parentRef === 'string' ? operation.args.parentRef : null
      if (parentRef && !refs.has(parentRef)) throw new Error(`parentRef desconhecido ou fora de ordem: ${parentRef}`)
      if (type === 'EPIC' && (parentRef || typeof operation.args.moduleName !== 'string' || !operation.args.moduleName.trim())) throw new Error('EPIC deve ser raiz e informar moduleName')
      if (type !== 'EPIC' && operation.args.moduleName !== null) throw new Error(`${type} não deve informar moduleName`)
      if (type === 'STORY' && (!parentRef || typesByRef.get(parentRef) !== 'EPIC')) throw new Error('STORY deve ter um EPIC anterior como parentRef')
      if ((type === 'TASK' || type === 'BUG') && (!parentRef || !['STORY', 'TASK', 'BUG'].includes(typesByRef.get(parentRef) ?? ''))) throw new Error(`${type} deve ter uma STORY, TASK ou BUG anterior como parentRef`)
      if (refs.has(operation.args.ref)) throw new Error(`ref duplicado: ${operation.args.ref}`)
      refs.add(operation.args.ref)
      typesByRef.set(operation.args.ref as string, type)
    }
  }
}
