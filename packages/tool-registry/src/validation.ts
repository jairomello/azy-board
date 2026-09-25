import { isRegisteredTool, requiredFieldsFor } from './fields.js'
import { TOOL_TEXT_LIMITS } from './limits.js'

export function assertNonEmptyString(value: unknown, field: string, maxLength = 200): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} deve ser uma string não vazia`)
  }
  if (value.trim().length > maxLength) {
    throw new Error(`${field} excede o limite de ${maxLength} caracteres (recebido: ${value.trim().length})`)
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
  // Fonte única: os obrigatórios vêm do registry (mesma definição que gera o
  // schema exposto), eliminando a tabela paralela que já divergiu no passado.
  if (!isRegisteredTool(name)) throw new Error(`Ferramenta desconhecida: ${name}`)
  const required = requiredFieldsFor(name)
  for (const field of required) {
    const value = args?.[field]
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) throw new Error(`Campo obrigatório ausente: ${field}`)
  }
  const input = args ?? {}
  for (const field of ['projectId', 'itemId', 'taskId', 'sprintId', 'tagId', 'versionId', 'userId', 'columnId', 'moduleId', 'checklistId', 'checklistItemId', 'assigneeId']) if (field in input && input[field] != null) assertNonEmptyString(input[field], field, 128)
  // null é tratado como "não informado" (clients strict enviam todos os campos).
  if (input.name != null) assertNonEmptyString(input.name, 'name', TOOL_TEXT_LIMITS.name)
  if (input.title != null) assertNonEmptyString(input.title, 'title', TOOL_TEXT_LIMITS.title)
  if (input.activity != null) assertNonEmptyString(input.activity, 'activity', TOOL_TEXT_LIMITS.activity)
  if (input.text != null) assertNonEmptyString(input.text, 'text', TOOL_TEXT_LIMITS.text)
  if (input.description != null) assertNonEmptyString(input.description, 'description', TOOL_TEXT_LIMITS.description)
  if (input.dueDate != null) assertIsoDate(input.dueDate, 'dueDate')
  if (input.advancedChecklists != null && typeof input.advancedChecklists !== 'boolean') throw new Error('advancedChecklists deve ser booleano')
  if (input.ref != null) assertNonEmptyString(input.ref, 'ref', TOOL_TEXT_LIMITS.ref)
  if (input.columnName != null) assertNonEmptyString(input.columnName, 'columnName', TOOL_TEXT_LIMITS.columnName)
  if (input.tagIds != null) assertStringArray(input.tagIds, 'tagIds')
  if (input.order != null) assertStringArray(input.order, 'order')
  if ('durationMin' in input && input.durationMin !== undefined && input.durationMin !== null) assertNonNegativeNumber(input.durationMin, 'durationMin')
  if (input.limit != null && (typeof input.limit !== 'number' || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
    throw new Error('limit, quando informado, deve ser um inteiro entre 1 e 100 (omita ou envie null para o padrão)')
  }
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
  } else if (name === 'update_checklist_item') {
    const changes = input.changes
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('changes deve ser um objeto')
    const value = changes as Record<string, unknown>
    const allowed = new Set(['text', 'checked', 'dueDate', 'assigneeId', 'description'])
    for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`Campo de alteração inválido: ${key}`)
    if (value.text !== undefined && value.text !== null) assertNonEmptyString(value.text, 'text', TOOL_TEXT_LIMITS.text)
    if (value.checked !== undefined && value.checked !== null && typeof value.checked !== 'boolean') throw new Error('checked deve ser booleano')
    if (value.dueDate !== undefined && value.dueDate !== null) assertIsoDate(value.dueDate, 'dueDate')
    if (value.assigneeId !== undefined && value.assigneeId !== null) assertNonEmptyString(value.assigneeId, 'assigneeId', 128)
    if (value.description !== undefined && value.description !== null && typeof value.description !== 'string') throw new Error('description deve ser uma string')
    if (typeof value.description === 'string' && value.description.length > TOOL_TEXT_LIMITS.description) throw new Error(`description excede o limite de ${TOOL_TEXT_LIMITS.description} caracteres`)
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
  if (name === 'batch_move') {
    assertStringArray(input.itemIds, 'itemIds', 500)
    if ((input.itemIds as string[]).length < 1) throw new Error('itemIds deve conter entre 1 e 500 IDs')
    assertNonEmptyString(input.columnName, 'columnName', TOOL_TEXT_LIMITS.columnName)
  }
  if (name === 'batch' || name === 'create_project_structure') {
    if (!Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 50) throw new Error('operations deve conter entre 1 e 50 entradas')
    const refs = new Set<string>()
    const typesByRef = new Map<string, string>()
    for (const operation of input.operations as Array<{ tool?: unknown; args?: Record<string, unknown> }>) {
      if (operation.tool !== 'create_task' || !operation.args) throw new Error('Operação de lote inválida')
      assertNonEmptyString(operation.args.ref, 'ref', TOOL_TEXT_LIMITS.ref)
      assertNonEmptyString(operation.args.title, 'title', TOOL_TEXT_LIMITS.title)
      assertEnum(operation.args.type, 'type', ['EPIC', 'STORY', 'TASK', 'BUG'])
      if (typeof operation.args.assignToCurrentUser !== 'boolean') throw new Error('assignToCurrentUser deve ser booleano')
      const type = operation.args.type as string
      const parentRef = typeof operation.args.parentRef === 'string' ? operation.args.parentRef : null
      if (parentRef && !refs.has(parentRef)) throw new Error(`parentRef desconhecido ou fora de ordem: ${parentRef}`)
      // EPIC sempre precisa de moduleName e não tem parent
      if (type === 'EPIC') {
        if (parentRef) throw new Error('EPIC não pode ter parentRef')
        if (typeof operation.args.moduleName !== 'string' || !operation.args.moduleName.trim()) throw new Error('EPIC deve informar moduleName')
      }
      if (type !== 'EPIC' && operation.args.moduleName !== null && operation.args.moduleName !== undefined) throw new Error(`${type} não deve informar moduleName`)
      // Validação de hierarquia: STORY precisa de EPIC como parent; TASK/BUG precisa de STORY, TASK ou BUG.
      // Para projetos SIMPLE, TASK/BUG podem não ter parentRef (o servidor atribui ao simpleStoryId automaticamente).
      if (type === 'STORY' && (!parentRef || typesByRef.get(parentRef) !== 'EPIC')) throw new Error('STORY deve ter um EPIC anterior como parentRef')
      if ((type === 'TASK' || type === 'BUG') && parentRef && !['STORY', 'TASK', 'BUG'].includes(typesByRef.get(parentRef) ?? '')) throw new Error(`${type} com parentRef deve apontar para uma STORY, TASK ou BUG anterior`)
      if (refs.has(operation.args.ref)) throw new Error(`ref duplicado: ${operation.args.ref}`)
      refs.add(operation.args.ref)
      typesByRef.set(operation.args.ref as string, type)
    }
  }
}
