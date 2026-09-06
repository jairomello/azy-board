import { createHash } from 'node:crypto'
import { checkAssistantGuardrails } from './assistantGuardrails'

export const IMPORT_LIMITS = { maxBytes: 1_000_000, maxLines: 1_000, maxColumns: 50, maxFieldLength: 500 } as const
const TYPES = new Set(['EPIC', 'STORY', 'TASK', 'BUG'])
const COLUMNS: Record<string, string> = { title: 'title', titulo: 'title', name: 'title', nome: 'title', description: 'description', descricao: 'description', type: 'type', tipo: 'type', priority: 'priority', prioridade: 'priority', points: 'points', pontos: 'points', parentid: 'parentId', parent: 'parentId', moduleid: 'moduleId', versionid: 'versionId' }

export type ImportError = { line: number; column?: string; code: string; message: string }
export type ImportRow = { line: number; values: Record<string, string> }
export type ParsedImport = { format: 'text' | 'csv'; columns: string[]; rows: ImportRow[]; errors: ImportError[] }
export type BatchPreview = { previewId: string; projectId: string; operations: Array<{ tool: 'create_task'; args: Record<string, unknown> }>; errors: ImportError[]; questions: string[]; operationHash: string; sourceHash: string }

const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function parseCsv(input: string): { cells: string[][]; errors: ImportError[] } {
  const cells: string[][] = [[]]; let field = ''; let quoted = false; const errors: ImportError[] = []
  for (let i = 0; i < input.length; i++) { const char = input[i]!
    if (char === '"') { if (quoted && input[i + 1] === '"') { field += '"'; i++ } else quoted = !quoted }
    else if (char === ',' && !quoted) { cells.at(-1)!.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && input[i + 1] === '\n') i++; cells.at(-1)!.push(field); field = ''; if (cells.length < IMPORT_LIMITS.maxLines) cells.push([]) }
    else field += char
    if (field.length > IMPORT_LIMITS.maxFieldLength) errors.push({ line: cells.length, code: 'FIELD_TOO_LARGE', message: `Campo excede ${IMPORT_LIMITS.maxFieldLength} caracteres` })
  }
  if (quoted) errors.push({ line: cells.length, code: 'UNTERMINATED_QUOTE', message: 'Aspas não terminadas' })
  if (field || cells.at(-1)!.length) cells.at(-1)!.push(field)
  return { cells: cells.filter(row => row.some(cell => cell.trim())), errors }
}

export function parseImport(input: string, limits = IMPORT_LIMITS): ParsedImport {
  if (typeof input !== 'string' || new TextEncoder().encode(input).byteLength > limits.maxBytes) return { format: 'text', columns: [], rows: [], errors: [{ line: 1, code: 'INPUT_TOO_LARGE', message: `Entrada excede ${limits.maxBytes} bytes` }] }
  const looksCsv = input.includes(',')
  if (!looksCsv) {
    const lines = input.split(/\r?\n/).filter(line => line.trim())
    const errors: ImportError[] = lines.length > limits.maxLines ? [{ line: limits.maxLines + 1, code: 'TOO_MANY_LINES', message: `Máximo de ${limits.maxLines} linhas` }] : []
    return { format: 'text', columns: ['title'], rows: lines.slice(0, limits.maxLines).map((title, index) => ({ line: index + 1, values: { title: title.trim() } })), errors }
  }
  const parsed = parseCsv(input); const [header = [], ...body] = parsed.cells
  const columns = header.map(normalize); const errors = [...parsed.errors]
  if (columns.length > limits.maxColumns) errors.push({ line: 1, code: 'TOO_MANY_COLUMNS', message: `Máximo de ${limits.maxColumns} colunas` })
  const mapped = columns.map(column => COLUMNS[column])
  columns.forEach((column, index) => { if (!mapped[index]) errors.push({ line: 1, column, code: 'UNKNOWN_COLUMN', message: `Coluna não reconhecida: ${column}` }) })
  if (!mapped.includes('title')) errors.push({ line: 1, code: 'TITLE_COLUMN_REQUIRED', message: 'A coluna title/titulo/nome é obrigatória' })
  const rows = body.slice(0, limits.maxLines).map((cells, rowIndex) => ({ line: rowIndex + 2, values: Object.fromEntries(mapped.map((name, index) => name ? [name, (cells[index] ?? '').trim()] : [])) }))
  if (body.length > limits.maxLines) errors.push({ line: limits.maxLines + 2, code: 'TOO_MANY_LINES', message: `Máximo de ${limits.maxLines} linhas` })
  return { format: 'csv', columns: mapped.filter(Boolean) as string[], rows, errors }
}

function normalizeRow(row: ImportRow): Record<string, unknown> {
  const values = row.values; const result: Record<string, unknown> = { title: values.title?.trim(), type: (values.type || 'TASK').trim().toUpperCase() }
  for (const key of ['description', 'parentId', 'moduleId', 'versionId', 'priority']) if (values[key]?.trim()) result[key] = values[key].trim()
  if (values.points?.trim()) { const points = Number(values.points); if (!Number.isFinite(points) || points < 0) throw new Error('POINTS_INVALID'); result.points = points }
  return result
}

export function createBatchPreview(projectId: string, input: string, defaultType = 'TASK'): BatchPreview {
  if (!projectId.trim()) throw new Error('PROJECT_REQUIRED')
  const parsed = parseImport(input); const errors = [...parsed.errors]; const operations: BatchPreview['operations'] = []; const questions: string[] = []
  for (const row of parsed.rows) { try {
    const args = normalizeRow({ ...row, values: { ...row.values, type: row.values.type || defaultType } });
    if (!args.title) { errors.push({ line: row.line, column: 'title', code: 'TITLE_REQUIRED', message: 'Título é obrigatório' }); continue }
    if (!TYPES.has(args.type as string)) { errors.push({ line: row.line, column: 'type', code: 'TYPE_INVALID', message: 'Tipo deve ser EPIC, STORY, TASK ou BUG' }); continue }
    const injection = checkAssistantGuardrails('criar item', String(args.title)); if (!injection.allowed) { errors.push({ line: row.line, column: 'title', code: injection.reason!, message: injection.message }); continue }
    operations.push({ tool: 'create_task', args: { projectId, ...args } })
  } catch (error) { errors.push({ line: row.line, code: error instanceof Error ? error.message : 'INVALID_ROW', message: 'Linha inválida' }) } }
  if (operations.some(operation => (operation.args.type === 'STORY' || operation.args.type === 'TASK' || operation.args.type === 'BUG') && operation.args.parentId === undefined && operation.args.type === 'STORY')) questions.push('Confirme o parentId da STORY antes de criar itens hierárquicos.')
  const sourceHash = digest({ projectId, input }); const operationHash = digest(operations); return { previewId: digest({ projectId, operations, errors }), projectId, operations, errors, questions, operationHash, sourceHash }
}

export function authorizedBatch(preview: BatchPreview, approval: { approved: boolean; operationHash: string }, authorize: (args: Record<string, unknown>) => void): { tool: 'batch'; args: Record<string, unknown> } {
  if (!approval.approved) throw new Error('PREVIEW_NOT_APPROVED')
  if (approval.operationHash !== preview.operationHash) throw new Error('PREVIEW_CHANGED')
  if (preview.errors.length || preview.questions.length) throw new Error('PREVIEW_NEEDS_CLARIFICATION')
  const args = { projectId: preview.projectId, operations: preview.operations, atomic: true, idempotencyKey: `azy-import:${preview.previewId}`, agentRunId: preview.previewId }
  authorize(args)
  return { tool: 'batch', args }
}
