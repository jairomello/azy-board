// Catálogo de campos exportáveis do Azy Board.
//
// Fonte única entre API e web: a API usa o catálogo para validar o mapeamento e
// extrair os valores; a web usa os mesmos ids e grupos para montar o editor de
// mapeamento por arrastar-e-soltar. Os rótulos visíveis ficam no i18n da web.

export type ExportFieldGroup =
  | 'identification'
  | 'hierarchy'
  | 'planning'
  | 'execution'
  | 'agile'
  | 'classification'
  | 'tracking'
  | 'metadata'

export type ExportFieldType = 'string' | 'number' | 'date' | 'boolean'

export const EXPORT_FIELD_TYPES: readonly ExportFieldType[] = ['string', 'number', 'date', 'boolean'] as const

export interface ExportFieldDefinition {
  /** Identificador técnico e nome da coluna no modo bruto (snake_case). */
  id: string
  group: ExportFieldGroup
  type: ExportFieldType
}

export const EXPORT_FIELD_GROUPS: readonly ExportFieldGroup[] = [
  'identification',
  'hierarchy',
  'planning',
  'execution',
  'agile',
  'classification',
  'tracking',
  'metadata',
] as const

export const EXPORT_FIELDS: readonly ExportFieldDefinition[] = [
  { id: 'id', group: 'identification', type: 'string' },
  { id: 'sequence_code', group: 'identification', type: 'string' },
  { id: 'type', group: 'identification', type: 'string' },
  { id: 'title', group: 'identification', type: 'string' },
  { id: 'description', group: 'identification', type: 'string' },

  { id: 'parent_sequence_code', group: 'hierarchy', type: 'string' },
  { id: 'parent_title', group: 'hierarchy', type: 'string' },
  { id: 'module', group: 'hierarchy', type: 'string' },
  { id: 'column', group: 'hierarchy', type: 'string' },
  { id: 'ancestry_path', group: 'hierarchy', type: 'string' },

  { id: 'status', group: 'planning', type: 'string' },
  { id: 'priority', group: 'planning', type: 'string' },
  { id: 'points', group: 'planning', type: 'number' },
  { id: 'start_date', group: 'planning', type: 'date' },
  { id: 'due_date', group: 'planning', type: 'date' },
  { id: 'sprint', group: 'planning', type: 'string' },
  { id: 'version', group: 'planning', type: 'string' },
  { id: 'cost_center', group: 'planning', type: 'string' },

  { id: 'assignee', group: 'execution', type: 'string' },
  { id: 'assignee_label', group: 'execution', type: 'string' },
  { id: 'author', group: 'execution', type: 'string' },
  { id: 'blocked_reason', group: 'execution', type: 'string' },
  { id: 'tokens_input', group: 'execution', type: 'number' },
  { id: 'tokens_output', group: 'execution', type: 'number' },
  { id: 'tokens_total', group: 'execution', type: 'number' },

  { id: 'persona', group: 'agile', type: 'string' },
  { id: 'goal', group: 'agile', type: 'string' },
  { id: 'benefit', group: 'agile', type: 'string' },
  { id: 'acceptance_criteria', group: 'agile', type: 'string' },
  { id: 'notes', group: 'agile', type: 'string' },

  { id: 'tags', group: 'classification', type: 'string' },
  { id: 'icon', group: 'classification', type: 'string' },
  { id: 'color', group: 'classification', type: 'string' },

  { id: 'external_source', group: 'tracking', type: 'string' },
  { id: 'external_ref', group: 'tracking', type: 'string' },
  { id: 'actual_start_date', group: 'tracking', type: 'date' },
  { id: 'actual_due_date', group: 'tracking', type: 'date' },

  { id: 'position', group: 'metadata', type: 'number' },
  { id: 'created_at', group: 'metadata', type: 'date' },
  { id: 'updated_at', group: 'metadata', type: 'date' },
  { id: 'project_id', group: 'metadata', type: 'string' },
] as const

// `assignee_label` fica em execution porque descreve quem executa o card, mesmo
// quando o responsável não possui conta no Azy Board.
const EXPORT_FIELDS_UNIQUE: readonly ExportFieldDefinition[] = EXPORT_FIELDS.filter(
  (field, index) => EXPORT_FIELDS.findIndex(candidate => candidate.id === field.id) === index,
)

export const EXPORT_FIELD_BY_ID: ReadonlyMap<string, ExportFieldDefinition> = new Map(
  EXPORT_FIELDS_UNIQUE.map(field => [field.id, field]),
)

export const EXPORT_FIELD_IDS: readonly string[] = EXPORT_FIELDS_UNIQUE.map(field => field.id)

export interface ExportMappingField {
  /** Campo de origem, sempre um id do catálogo. */
  source: string
  /** Nome da coluna no arquivo exportado. */
  target: string
  /** Tipo escolhido no destino; ausente = tipo automático do catálogo. */
  type?: ExportFieldType
}

export interface ExportMappingRecord {
  id: string
  projectId: string
  name: string
  fields: ExportMappingField[]
  createdAt: string
  updatedAt: string
}

export interface ExportMappingInput {
  name: string
  fields: ExportMappingField[]
}

export type ExportFormat = 'csv' | 'xlsx'
export type ExportMode = 'raw' | 'dynamic'

/**
 * Normaliza o nome de destino: o arquivo é consumido por planilhas e
 * integrações, então o nome não pode ter quebras de linha nem vir vazio.
 */
export function normalizeExportTargetName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Regras de um mapeamento válido, compartilhadas entre API (autoridade) e web
 * (feedback imediato). Retorna lista vazia quando está válido.
 */
export function validateExportMapping(fields: readonly ExportMappingField[]): string[] {
  const errors: string[] = []
  if (fields.length === 0) errors.push('EMPTY_MAPPING')
  const seenSources = new Set<string>()
  const seenTargets = new Set<string>()
  for (const field of fields) {
    if (!EXPORT_FIELD_BY_ID.has(field.source)) errors.push(`UNKNOWN_SOURCE:${field.source}`)
    const target = normalizeExportTargetName(field.target)
    if (!target) errors.push(`EMPTY_TARGET:${field.source}`)
    if (target.length > 120) errors.push(`LONG_TARGET:${field.source}`)
    if (field.type && !EXPORT_FIELD_TYPES.includes(field.type)) errors.push(`UNKNOWN_TYPE:${field.source}`)
    if (seenSources.has(field.source)) errors.push(`DUPLICATE_SOURCE:${field.source}`)
    const targetKey = target.toLocaleLowerCase('pt-BR')
    if (seenTargets.has(targetKey)) errors.push(`DUPLICATE_TARGET:${target}`)
    seenSources.add(field.source)
    seenTargets.add(targetKey)
  }
  return errors
}
