import type { ExportMappingField } from '@azy-board/domain'
import { EXPORT_FIELD_BY_ID, EXPORT_FIELD_IDS, normalizeExportTargetName, validateExportMapping } from '@azy-board/domain'
import type { ItemWithRelationsRecord } from '../persistence/models'

// Projeções auxiliares para resolver nomes de catálogos do projeto sem N+1.
export interface ExportCatalogContext {
  modules: Array<{ id: string; name: string }>
  columns: Array<{ id: string; name: string }>
  sprints: Array<{ id: string; name: string }>
  costCenters: Array<{ id: string; code: string }>
}

export interface ExportColumn {
  source: string
  header: string
  type: 'string' | 'number' | 'date' | 'boolean'
}

export type ExportCell = string | number | boolean | null

export interface ExportTable {
  columns: ExportColumn[]
  rows: ExportCell[][]
}

function formatAncestryPath(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return ''
    return parsed
      .map(node => {
        if (!node || typeof node !== 'object') return ''
        const title = (node as { title?: unknown }).title
        return typeof title === 'string' ? title : ''
      })
      .filter(Boolean)
      .join(' > ')
  } catch {
    return ''
  }
}

function listNames(links: Array<{ tag?: { name: string } }>): string {
  return links.map(link => link.tag?.name).filter((name): name is string => Boolean(name)).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ')
}

function valueFor(field: string, item: ItemWithRelationsRecord, catalogs: ExportCatalogContext, itemsById: Map<string, ItemWithRelationsRecord>): ExportCell {
  const moduleName = item.moduleId ? catalogs.modules.find(module => module.id === item.moduleId)?.name ?? '' : ''
  const columnName = item.columnId ? catalogs.columns.find(column => column.id === item.columnId)?.name ?? '' : ''
  const costCenter = item.costCenterId ? catalogs.costCenters.find(center => center.id === item.costCenterId)?.code ?? '' : ''
  const parent = item.parentId ? itemsById.get(item.parentId) : undefined
  switch (field) {
    case 'id': return item.id
    case 'sequence_code': return item.sequenceCode ?? ''
    case 'type': return item.type
    case 'title': return item.title
    case 'description': return item.description ?? ''
    case 'parent_sequence_code': return parent?.sequenceCode ?? ''
    case 'parent_title': return parent?.title ?? ''
    case 'module': return moduleName
    case 'column': return columnName
    case 'ancestry_path': return formatAncestryPath(item.ancestryPath)
    case 'status': return item.status
    case 'priority': return item.priority
    case 'points': return item.points ?? ''
    case 'start_date': return item.startDate ?? ''
    case 'due_date': return item.dueDate ?? ''
    case 'sprint': return item.itemSprints
      .map(link => catalogs.sprints.find(sprint => sprint.id === link.sprintId)?.name ?? '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .join(', ')
    case 'version': return item.version?.name ?? ''
    case 'cost_center': return costCenter
    case 'assignee': return item.assignee?.name ?? ''
    case 'assignee_label': return item.assigneeLabel ?? ''
    case 'author': return item.author?.name ?? ''
    case 'blocked_reason': return item.blockedReason ?? ''
    case 'tokens_input': return item.tokensInput ?? ''
    case 'tokens_output': return item.tokensOutput ?? ''
    case 'tokens_total': return (item.tokensInput ?? 0) + (item.tokensOutput ?? 0)
    case 'persona': return item.persona ?? ''
    case 'goal': return item.goal ?? ''
    case 'benefit': return item.benefit ?? ''
    case 'acceptance_criteria': return item.acceptanceCriteria ?? ''
    case 'notes': return item.notes ?? ''
    case 'tags': return listNames(item.itemTags)
    case 'icon': return item.icon ?? ''
    case 'color': return item.color ?? ''
    case 'external_source': return item.externalSource ?? ''
    case 'external_ref': return item.externalRef ?? ''
    case 'actual_start_date': return item.actualStartDate ?? ''
    case 'actual_due_date': return item.actualDueDate ?? ''
    case 'position': return item.position
    case 'created_at': return item.createdAt
    case 'updated_at': return item.updatedAt
    case 'project_id': return item.projectId
    default: return ''
  }
}

function columnsFor(fields: readonly ExportMappingField[]): ExportColumn[] {
  return fields.map(field => {
    const definition = EXPORT_FIELD_BY_ID.get(field.source)
    return {
      source: field.source,
      // O modo bruto usa o id técnico; o dinâmico usa o nome definido no mapeamento.
      header: normalizeExportTargetName(field.target) || field.source,
      // O tipo do destino pode ser sobrescrito no mapeamento; sem override,
      // herda o tipo do campo de origem no catálogo.
      type: field.type ?? definition?.type ?? 'string',
    }
  })
}

/** Exportação bruta: todas as colunas do catálogo, com os nomes técnicos. */
export function buildRawExportTable(items: ItemWithRelationsRecord[], catalogs: ExportCatalogContext): ExportTable {
  const fields = EXPORT_FIELD_IDS.map(source => ({ source, target: source }))
  return buildExportTable(items, catalogs, fields)
}

/** Exportação dinâmica: colunas na ordem e com os nomes definidos no mapeamento. */
export function buildDynamicExportTable(items: ItemWithRelationsRecord[], catalogs: ExportCatalogContext, fields: readonly ExportMappingField[]): ExportTable {
  const errors = validateExportMapping(fields)
  if (errors.length > 0) throw new Error(`INVALID_EXPORT_MAPPING:${errors.join(',')}`)
  return buildExportTable(items, catalogs, fields)
}

/** Converte o valor bruto para o tipo escolhido no destino. */
export function coerceExportValue(value: ExportCell, type: ExportColumn['type']): ExportCell {
  if (value === null || value === '') return value
  if (type === 'number') {
    if (typeof value === 'number') return value
    const parsed = Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : value
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value
    const normalized = String(value).trim().toLocaleLowerCase('pt-BR')
    if (['true', '1', 'sim', 'yes'].includes(normalized)) return true
    if (['false', '0', 'nao', 'não', 'no'].includes(normalized)) return false
    return value
  }
  if (type === 'string' && typeof value !== 'string') return String(value)
  return value
}

function buildExportTable(items: ItemWithRelationsRecord[], catalogs: ExportCatalogContext, fields: readonly ExportMappingField[]): ExportTable {
  const itemsById = new Map(items.map(item => [item.id, item]))
  const columns = columnsFor(fields)
  const rows = items.map(item => columns.map(column => coerceExportValue(valueFor(column.source, item, catalogs, itemsById), column.type)))
  return { columns, rows }
}

/** CSV RFC 4180 com BOM UTF-8 para abrir corretamente no Excel. */
export function toCsv(table: ExportTable): string {
  const escapeCsv = (value: ExportCell): string => {
    if (value === null) return ''
    const text = String(value)
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const lines = [table.columns.map(column => escapeCsv(column.header)).join(','), ...table.rows.map(row => row.map(escapeCsv).join(','))]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
