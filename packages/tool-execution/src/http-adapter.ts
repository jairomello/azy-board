/**
 * Adaptadores HTTP das ferramentas — independentes do transporte MCP stdio.
 * Cada função recebe um `api` injetado, facilitando testes sem subprocess.
 */

export type ApiCall = (path: string, method?: string, body?: unknown) => Promise<unknown>

// Campos de texto longo que inflam a saída de descoberta (board/tree).
const HEAVY_TEXT_FIELDS = new Set(['description', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'scope'])
const TEXT_PREVIEW_LENGTH = 160

function summarizeLongText(value: string): string {
  const plain = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > TEXT_PREVIEW_LENGTH ? `${plain.slice(0, TEXT_PREVIEW_LENGTH)}…` : plain
}

// Reduz descrições longas recursivamente quando o cliente não pede o texto completo.
function compactLongText(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactLongText)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      HEAVY_TEXT_FIELDS.has(key) && typeof item === 'string' ? summarizeLongText(item) : compactLongText(item),
    ]),
  )
}

export type BatchOperation = { tool: 'create_task' | 'create_item'; args: Record<string, unknown> }
export type ProjectStructureOperation = BatchOperation

export async function toolBatch(api: ApiCall, args: { projectId: string; operations: BatchOperation[]; atomic?: boolean; idempotencyKey?: string; agentRunId?: string }): Promise<unknown> {
  if (!Array.isArray(args.operations) || args.operations.length < 1 || args.operations.length > 50) throw new Error('operations deve conter entre 1 e 50 entradas')
  const { projectId, ...body } = args
  return api(`/projects/${projectId}/batch`, 'POST', body)
}

export type ItemFieldChange = {
  field: string
  operation: 'SET' | 'CLEAR' | 'TODAY' | 'OFFSET_DAYS' | 'COPY_CREATED_DATE'
  value: string | null
}

export type ItemUpdateFilters = {
  itemIds: string[] | null
  types: string[] | null
  statuses: string[] | null
  sprint: string | null
  version: string | null
  module: string | null
  assignee: string | null
  parent: string | null
  column: string | null
  tag: string | null
  titleContains: string | null
  onlyLeaves: boolean | null
  matchAll: boolean
}

export async function toolUpdateItems(api: ApiCall, args: { projectId: string; filters: ItemUpdateFilters; changes: ItemFieldChange[] }, agentRunId?: string): Promise<unknown> {
  const { projectId, ...body } = args
  return api(`/projects/${projectId}/batch/items/update`, 'POST', { ...body, agentRunId })
}

export async function toolBatchMove(api: ApiCall, args: { projectId: string; itemIds: string[]; columnName: string }, agentRunId?: string): Promise<unknown> {
  if (!Array.isArray(args.itemIds) || args.itemIds.length < 1 || args.itemIds.length > 500) throw new Error('itemIds deve conter entre 1 e 500 IDs')
  if (typeof args.columnName !== 'string' || !args.columnName.trim()) throw new Error('columnName é obrigatório')
  return toolUpdateItems(api, {
    projectId: args.projectId,
    filters: { itemIds: args.itemIds, types: null, statuses: null, sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false },
    changes: [{ field: 'column', operation: 'SET', value: args.columnName.trim() }],
  }, agentRunId)
}

// ─── Shapes de resposta usadas internamente ────────────────────────────────

interface Column   { id: string; name: string; baseStatus: string }
interface Module   { id: string; name: string; position: number }
interface Item     { id: string; type: string; title: string; isLeaf: boolean; parentId?: string | null; columnId?: string | null; status?: string; [key: string]: unknown }
export interface Page<T> { data: T[]; page?: number; limit?: number; total?: number; hasMore?: boolean; nextCursor?: string | null }
interface Checklist { id: string; name: string; position: number; items: ChecklistItem[] }
interface ChecklistItem { id: string; text: string; checked: boolean; position: number; dueDate?: string | null; assigneeId?: string | null; description?: string | null }
interface Resource { id: string; name: string; [key: string]: unknown }

export interface ProjectSummary {
  id: string
  name: string
  description?: string | null
  boardMode?: 'HIERARCHICAL' | 'SIMPLE'
  simpleStoryId?: string | null
  startDate?: string | null
  plannedEndDate?: string | null
  plannedPoints?: number | null
  plannedHours?: number | null
  scope?: string | null
  icon?: string | null
  color?: string | null
  role?: string
}

export async function toolListProjects(api: ApiCall): Promise<ProjectSummary[]> {
  return api('/projects') as Promise<ProjectSummary[]>
}

export async function toolGetProject(api: ApiCall, projectId: string): Promise<ProjectSummary> {
  return api(`/projects/${projectId}`) as Promise<ProjectSummary>
}

export async function toolGetBoard(api: ApiCall, projectId: string, includeDescriptions = false, includeDetails = false): Promise<unknown> {
  const board = await api(`/projects/${projectId}/board`)
  const shaped = includeDetails ? board : summarizeDiscoveryPayload(board)
  return includeDescriptions ? shaped : compactLongText(shaped)
}

export async function toolGetTree(api: ApiCall, projectId: string, options?: { moduleId?: string; assigneeId?: string; sprintId?: string; includeDescriptions?: boolean; includeDetails?: boolean }): Promise<unknown> {
  const params = new URLSearchParams()
  if (options?.moduleId) params.set('moduleId', options.moduleId)
  if (options?.assigneeId) params.set('assigneeId', options.assigneeId)
  if (options?.sprintId) params.set('sprintId', options.sprintId)
  const query = params.toString()
  const tree = await api(`/projects/${projectId}/items/tree${query ? `?${query}` : ''}`)
  const shaped = options?.includeDetails ? tree : summarizeDiscoveryPayload(tree)
  return options?.includeDescriptions ? shaped : compactLongText(shaped)
}

// Card B7 — modo summary: por item, devolve apenas a projeção leve; campos
// pesados só entram com includeDetails=true. Guarda por forma de card.
const SUMMARY_ITEM_FIELDS = new Set(['id', 'sequenceCode', 'title', 'type', 'status', 'parentId', 'columnId', 'moduleId', 'priority', 'assigneeId', 'points'])
const OVERVIEW_SAMPLE_PER_COLUMN = 20

function summarizeDiscoveryPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(summarizeDiscoveryPayload)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const isCard = typeof record.title === 'string' && 'type' in record && ('columnId' in record || 'parentId' in record || 'ancestryPath' in record)
  if (isCard) return Object.fromEntries(Object.entries(record).filter(([key]) => SUMMARY_ITEM_FIELDS.has(key)))
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, summarizeDiscoveryPayload(item)]))
}

// Digest de uma única chamada (proposal: descoberta em um passo). Agrega o
// board-summary por coluna/status/tipo; SCREEN valida os IDs do snapshot
// contra o board atual (IDs que sumiram são descartados, nunca somados).
type DiscoveryBoard = { columns: Array<{ id: string; name: string }>; items: Array<Record<string, unknown>> }

function overviewFromBoard(board: DiscoveryBoard, options: { contextId: string | null; capturedAt: string | null; target: 'SCREEN' | 'PROJECT'; displayedItemIds?: string[] }): unknown {
  const columns = board.columns ?? []
  const selectedIds = options.displayedItemIds ? new Set(options.displayedItemIds) : null
  const perColumn = new Map(columns.map(column => [column.id, { id: column.id, name: column.name, total: 0, TASK: 0, BUG: 0, refs: [] as string[] }]))
  let displayedCount = 0
  for (const item of board.items ?? []) {
    if (selectedIds && (!item.id || !selectedIds.has(String(item.id)))) continue
    const bucket = perColumn.get(String(item.columnId))
    if (!bucket) continue
    displayedCount++
    bucket.total++
    if (item.type === 'TASK') bucket.TASK++
    if (item.type === 'BUG') bucket.BUG++
    if (bucket.refs.length < OVERVIEW_SAMPLE_PER_COLUMN) {
      const code = item.sequenceCode ? `${String(item.sequenceCode)} ` : ''
      bucket.refs.push(`${code}${String(item.title ?? '')}`)
    }
  }
  return {
    contextId: options.contextId,
    capturedAt: options.capturedAt,
    target: options.target,
    scopeMode: options.displayedItemIds ? 'FILTERED' : 'ALL',
    displayedCount,
    totalMatchingCount: options.displayedItemIds ? options.displayedItemIds.length : displayedCount,
    filters: {},
    columns: [...perColumn.values()].filter(Boolean),
  }
}

export async function toolGetScreenOverview(api: ApiCall, args: { projectId: string; scope?: 'SCREEN' | 'PROJECT' }, context?: { screenSnapshot?: { contextId: string; capturedAt: string; results?: { displayedItemIds?: string[] } | null; projectId?: string | null } }): Promise<unknown> {
  if (args.scope === 'SCREEN') {
    const snapshot = context?.screenSnapshot
    if (!snapshot?.results?.displayedItemIds) throw new Error('SCREEN_CONTEXT_REQUIRED: não há snapshot do recorte de tela deste run; use scope=PROJECT')
    const board = await api(`/projects/${args.projectId}/board`) as DiscoveryBoard
    return overviewFromBoard(board, { contextId: snapshot.contextId, capturedAt: snapshot.capturedAt, target: 'SCREEN', displayedItemIds: snapshot.results.displayedItemIds })
  }
  const board = await api(`/projects/${args.projectId}/board`) as DiscoveryBoard
  return overviewFromBoard(board, { contextId: null, capturedAt: null, target: 'PROJECT' })
}

// Card T20 — leitura das métricas oficiais do Dashboard. O adaptador reproduz a
// consulta da tela (mesmas rotas /dashboard/*) para garantir paridade de regra e
// número; a normalização expõe critérios, cobertura e populações sobrepostas.
export type DashboardMetric = 'snapshot' | 'burnup' | 'aging' | 'hours' | 'sprint'

export interface DashboardMetricsArgs {
  projectId: string
  metric: DashboardMetric
  from?: string | null
  to?: string | null
  moduleId?: string | null
  sprintId?: string | null
  versionId?: string | null
  squadId?: string | null
  assigneeId?: string | null
  type?: string | null
  cycleId?: string | null
  includeItems?: boolean | null
  limit?: number | null
  cursor?: string | null
  detail?: 'wip' | 'blocked' | 'overdue' | 'remaining' | null
}

type DashboardToolContext = {
  screenSnapshot?: {
    screen?: string
    dashboard?: { filters?: Record<string, unknown> | null; period?: { from?: unknown; to?: unknown } | null } | null
  } | null
} | undefined

const DASHBOARD_ITEM_SAMPLE = 20
const DASHBOARD_POPULATION_KEYS = ['moduleId', 'sprintId', 'versionId', 'squadId', 'assigneeId', 'type'] as const

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

// Filtro explícito prevalece; na tela do Dashboard, herda os filtros da fotografia.
function dashboardFilter(args: DashboardMetricsArgs, context: DashboardToolContext, key: (typeof DASHBOARD_POPULATION_KEYS)[number]): string | null {
  const explicit = nonEmptyString(args[key])
  if (explicit) return explicit
  if (context?.screenSnapshot?.screen !== 'project-dashboard') return null
  return nonEmptyString(context.screenSnapshot.dashboard?.filters?.[key])
}

function dashboardPeriod(args: DashboardMetricsArgs, context: DashboardToolContext): { from: string | null; to: string | null } {
  const onDashboard = context?.screenSnapshot?.screen === 'project-dashboard'
  return {
    from: nonEmptyString(args.from) ?? (onDashboard ? nonEmptyString(context?.screenSnapshot?.dashboard?.period?.from) : null),
    to: nonEmptyString(args.to) ?? (onDashboard ? nonEmptyString(context?.screenSnapshot?.dashboard?.period?.to) : null),
  }
}

function sampleRows(rows: unknown, totalRows?: number, pageTruncated = false): { rows: unknown[]; total: number; truncated: boolean } {
  const list = Array.isArray(rows) ? rows : []
  return { rows: list.slice(0, DASHBOARD_ITEM_SAMPLE), total: totalRows ?? list.length, truncated: list.length > DASHBOARD_ITEM_SAMPLE || pageTruncated }
}

function dashboardCriteria(metric: DashboardMetric): string[] {
  if (metric === 'snapshot') return [
    'Folhas TASK/BUG não arquivadas; a condição de folha é determinada antes dos filtros.',
    'WIP reúne status IN_PROGRESS e BLOCKED; Bloqueados é subconjunto do WIP e Atrasados sobrepõe o WIP.',
    'Progresso e Carga por pontos usam apenas itens estimados; a cobertura de estimativa é informada.',
  ]
  if (metric === 'burnup') return [
    'Estado ao fim de cada dia UTC desde coverageStartedAt; escopo = folhas TASK/BUG não arquivadas e concluído = DONE.',
    'Mudanças de escopo aparecem na linha total; período anterior à cobertura é parcial.',
  ]
  if (metric === 'aging') return [
    'Idade do episódio ativo atual (entrada em IN_PROGRESS/BLOCKED); transição entre eles não zera o episódio.',
    'Item já ativo no baseline sem início conhecido tem idade mínima desde coverageStartedAt.',
  ]
  if (metric === 'hours') return [
    'Somente logs manuais com durationMin > 0; a data de registro é o createdAt.',
    'Agrupamento pelo autor do log e pelo squad atual do autor; não inferir horas pelo responsável do item.',
  ]
  return [
    'Compromisso = folhas do início do ciclo; escopo atual no corte min(agora, endedAt).',
    'Ciclo MIGRATION é parcial; carry-over só é exibido quando a associação posterior é observada.',
  ]
}

function dashboardPopulations(metric: DashboardMetric): Record<string, unknown> {
  if (metric !== 'snapshot') return { additive: true, note: 'Indicador sem sobreposição com outros.' }
  return {
    additive: false,
    note: 'Referem-se ao estado atual e se sobrepõem; não somar WIP, Bloqueados e Atrasados como populações distintas.',
    wipIncludesBlocked: true,
    blockedSubsetOfWip: true,
    overdueOverlapsWip: true,
    teamLoadBlockedSubsetOfWip: true,
  }
}

function dashboardEnvelope(metric: DashboardMetric, payload: unknown, filters: Record<string, string>, period: { from: string | null; to: string | null }, includeItems: boolean, detail?: DashboardMetricsArgs['detail']): Record<string, unknown> {
  const record = (payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}) as Record<string, unknown>
  const boxes = (record.boxes && typeof record.boxes === 'object' && !Array.isArray(record.boxes) ? record.boxes : {}) as Record<string, unknown>
  let data: Record<string, unknown>
  let items: unknown[] = []
  let truncated = false

  if (metric === 'snapshot') {
    const wip = (boxes.wip ?? {}) as Record<string, unknown>
    const blocked = (boxes.blocked ?? {}) as Record<string, unknown>
    const overdue = (boxes.overdue ?? {}) as Record<string, unknown>
    const blockedPagination = blocked.pagination as Record<string, unknown> | undefined
    const overduePagination = overdue.pagination as Record<string, unknown> | undefined
    const remainingPagination = overdue.remainingPagination as Record<string, unknown> | undefined
    const wipPagination = wip.pagination as Record<string, unknown> | undefined
    const remainingSample = sampleRows(overdue.remainingItems, typeof remainingPagination?.total === 'number' ? remainingPagination.total : undefined, Boolean(remainingPagination?.hasMore))
    const blockedSample = sampleRows(blocked.items, Number(blocked.total ?? 0), Boolean(blockedPagination?.hasMore))
    const overdueSample = sampleRows(overdue.items, Number(overdue.total ?? 0), Boolean(overduePagination?.hasMore))
    const wipSample = sampleRows(wip.items, Number(wip.total ?? 0), Boolean(wipPagination?.hasMore))
    const selectedSample = detail === 'wip' ? wipSample : detail === 'overdue' ? overdueSample : detail === 'remaining' ? remainingSample : blockedSample
    data = {
      coverage: record.coverage ?? null,
      progressScope: boxes.progressScope ?? null,
      wip: { total: wip.total ?? null, byStatus: wip.byStatus ?? null, byStatusPoints: wip.byStatusPoints ?? null, pointsCoverage: wip.pointsCoverage ?? null, pagination: wipPagination ?? null },
      blocked: { total: blocked.total ?? null, items: blockedSample.rows, pagination: blockedPagination ?? null },
      overdue: {
        total: overdue.total ?? null, points: overdue.points ?? null, items: overdueSample.rows,
        remainingCount: typeof remainingPagination?.total === 'number' ? remainingPagination.total : Array.isArray(overdue.remainingItems) ? overdue.remainingItems.length : null,
        pagination: overduePagination ?? null, remainingPagination: remainingPagination ?? null,
      },
      teamLoad: boxes.teamLoad ?? null,
    }
    items = includeItems ? selectedSample.rows : []
    truncated = detail ? selectedSample.truncated : blockedSample.truncated || overdueSample.truncated || wipSample.truncated || remainingSample.truncated
  } else if (metric === 'aging') {
    const pagination = record.pagination && typeof record.pagination === 'object' && !Array.isArray(record.pagination) ? record.pagination as Record<string, unknown> : null
    const sample = sampleRows(record.items, typeof record.total === 'number' ? record.total : undefined, Boolean(pagination?.hasMore))
    data = { coverageStartedAt: record.coverageStartedAt ?? null, total: sample.total, pagination, items: includeItems ? sample.rows : [] }
    items = includeItems ? sample.rows : []
    truncated = sample.truncated
  } else if (metric === 'burnup') {
    data = { partial: record.partial ?? null, coverageStartedAt: record.coverageStartedAt ?? null, projection: record.projection ?? null, warnings: Array.isArray(record.warnings) ? record.warnings : [], series: Array.isArray(record.series) ? record.series : [] }
  } else if (metric === 'hours') {
    const sample = sampleRows(record.rows)
    const pagination = record.pagination && typeof record.pagination === 'object' && !Array.isArray(record.pagination) ? record.pagination : null
    const totalRows = typeof record.totalRows === 'number' ? record.totalRows : sample.total
    data = {
      semantics: record.semantics ?? null, totalMinutes: record.totalMinutes ?? null,
      totalRows, byAuthor: Array.isArray(record.byAuthor) ? record.byAuthor : [],
      pagination, total: totalRows, rows: includeItems ? sample.rows : [],
    }
    items = includeItems ? sample.rows : []
    truncated = sample.truncated || Boolean(pagination && (pagination as Record<string, unknown>).hasMore)
  } else {
    data = record
  }

  const routeFilters = record.filters && typeof record.filters === 'object' && !Array.isArray(record.filters) ? record.filters as Record<string, unknown> : null
  const routeApplied = Array.isArray(routeFilters?.applied) ? routeFilters!.applied as string[] : null
  const routeInapplicable = Array.isArray(routeFilters?.inapplicable) ? routeFilters!.inapplicable as string[] : null
  const inapplicable = routeInapplicable ?? (metric === 'snapshot' || metric === 'aging' ? ['from', 'to'] : [])
  const coverage = metric === 'snapshot'
    ? (record.coverage ?? null)
    : metric === 'hours'
      ? { semantics: record.semantics ?? null }
      : { partial: record.partial ?? null, coverageStartedAt: record.coverageStartedAt ?? null }

  return {
    metric,
    capturedAt: new Date().toISOString(),
    filters: { applied: routeApplied ?? Object.keys(filters), inapplicable, period, values: filters },
    criteria: dashboardCriteria(metric),
    populations: dashboardPopulations(metric),
    coverage,
    data,
    items,
    truncated,
  }
}

export async function toolGetDashboardMetrics(api: ApiCall, args: DashboardMetricsArgs, context?: DashboardToolContext): Promise<unknown> {
  const projectId = nonEmptyString(args.projectId)
  if (!projectId) throw new Error('projectId é obrigatório')
  const metric = args.metric
  if (!['snapshot', 'burnup', 'aging', 'hours', 'sprint'].includes(metric)) throw new Error(`metric inválido: ${String(metric)}`)
  if (metric === 'snapshot' && args.cursor && !args.detail) throw new Error('detail é obrigatório ao continuar um cursor de snapshot')
  if (args.detail && metric !== 'snapshot') throw new Error('detail só se aplica à métrica snapshot')
  const filters = Object.fromEntries(
    DASHBOARD_POPULATION_KEYS.map(key => [key, dashboardFilter(args, context, key)]).filter(([, value]) => value !== null),
  ) as Record<string, string>
  const period = dashboardPeriod(args, context)
  if (metric === 'sprint') {
    const cycleId = nonEmptyString(args.cycleId)
    const params = new URLSearchParams()
    if (args.limit != null) params.set('limit', String(args.limit))
    if (args.cursor) params.set('cursor', args.cursor)
    const suffix = !cycleId && params.size ? `?${params.toString()}` : ''
    const payload = await api(cycleId ? `/projects/${projectId}/dashboard/sprints/${cycleId}` : `/projects/${projectId}/dashboard/sprints${suffix}`)
    return dashboardEnvelope(metric, payload, filters, period, args.includeItems !== false, args.detail)
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) params.set(key, value)
  if (period.from) params.set('from', period.from)
  if (period.to) params.set('to', period.to)
  if (args.limit != null) params.set('limit', String(args.limit))
  if (args.cursor) {
    if (metric === 'snapshot' && args.detail) params.set(`${args.detail}Cursor`, args.cursor)
    else if (metric !== 'snapshot') params.set('cursor', args.cursor)
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  const payload = await api(`/projects/${projectId}/dashboard/${metric}${query}`)
  return dashboardEnvelope(metric, payload, filters, period, args.includeItems !== false, args.detail)
}

export async function toolGetShadowMarkdown(api: ApiCall, projectId: string): Promise<unknown> {
  return api(`/projects/${projectId}/board.md`)
}

export async function toolCreateProject(api: ApiCall, args: { name: string; description?: string; boardMode?: 'HIERARCHICAL' | 'SIMPLE'; managerUserId?: string; startDate?: string | null; plannedEndDate?: string | null; plannedPoints?: number | null; plannedHours?: number | null; scope?: string | null; icon?: string | null; color?: string | null }): Promise<ProjectSummary> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  const boardMode = typeof args.boardMode === 'string'
    ? /^(default|padr[aã]o)$/i.test(args.boardMode.trim()) ? undefined : /^(simple|simples)$/i.test(args.boardMode) ? 'SIMPLE' : /^(hierarchical|hierarquico|hierárquico)$/i.test(args.boardMode) ? 'HIERARCHICAL' : args.boardMode.toUpperCase()
    : args.boardMode
  return api('/projects', 'POST', { ...args, boardMode, name: args.name.trim() }) as Promise<ProjectSummary>
}

export async function toolCreateProjectStructure(api: ApiCall, args: { name: string; description?: string; boardMode?: 'HIERARCHICAL' | 'SIMPLE'; operations: ProjectStructureOperation[]; managerUserId?: string; startDate?: string | null; plannedEndDate?: string | null; plannedPoints?: number | null; plannedHours?: number | null; scope?: string | null; icon?: string | null; color?: string | null }): Promise<unknown> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  if (!Array.isArray(args.operations) || args.operations.length < 1 || args.operations.length > 50) throw new Error('operations deve conter entre 1 e 50 entradas')
  const project = await toolCreateProject(api, { name: args.name, description: args.description, boardMode: args.boardMode, managerUserId: args.managerUserId, startDate: args.startDate, plannedEndDate: args.plannedEndDate, plannedPoints: args.plannedPoints, plannedHours: args.plannedHours, scope: args.scope, icon: args.icon, color: args.color })
  const batch = await toolBatch(api, { projectId: project.id, operations: args.operations, atomic: true })
  return { project, batch }
}

export async function toolUpdateProject(api: ApiCall, projectId: string, changes: Record<string, unknown>): Promise<ProjectSummary> {
  return api(`/projects/${projectId}`, 'PATCH', changes) as Promise<ProjectSummary>
}

export async function toolUpdateItem(api: ApiCall, projectId: string, itemId: string, changes: Record<string, unknown> | ItemFieldChange[], agentRunId?: string): Promise<unknown> {
  if (Array.isArray(changes)) {
    return toolUpdateItems(api, { projectId, filters: { itemIds: [itemId], types: null, statuses: null, sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false }, changes }, agentRunId)
  }
  return api(`/projects/${projectId}/items/${itemId}`, 'PATCH', changes)
}

export async function toolReleaseTask(api: ApiCall, projectId: string, taskId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${taskId}/release`, 'PATCH')
}

export async function toolDeleteItem(api: ApiCall, projectId: string, itemId: string, dryRun = false): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}`, 'DELETE', dryRun ? { dryRun: true } : undefined)
}

export async function toolDeleteProject(api: ApiCall, projectId: string, dryRun = false): Promise<unknown> {
  return api(`/projects/${projectId}`, 'DELETE', dryRun ? { dryRun: true } : undefined)
}

export async function toolArchiveItem(api: ApiCall, projectId: string, itemId: string, confirm = true, dryRun = false): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/archive`, 'POST', { confirm, dryRun })
}

export async function toolUnarchiveItem(api: ApiCall, projectId: string, itemId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/unarchive`, 'POST')
}

export async function toolCreateModule(api: ApiCall, projectId: string, name: string, description?: string): Promise<Resource> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/modules`, 'POST', { name: name.trim(), description }) as Promise<Resource>
}

export async function toolListColumns(api: ApiCall, projectId: string): Promise<Column[]> {
  return api(`/projects/${projectId}/columns`) as Promise<Column[]>
}

export async function toolCreateColumn(api: ApiCall, projectId: string, args: { name: string; baseStatus: string }): Promise<Column> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/columns`, 'POST', { ...args, name: args.name.trim() }) as Promise<Column>
}

export async function toolReorderColumns(api: ApiCall, projectId: string, order: string[]): Promise<unknown> {
  if (order.length === 0) throw new Error('order não pode ser vazio')
  return api(`/projects/${projectId}/columns/reorder`, 'PATCH', { order })
}

export async function toolListSprints(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/sprints`) as Promise<Resource[]>
}

export async function toolCreateSprint(api: ApiCall, projectId: string, args: { name: string; startDate?: string; endDate?: string }): Promise<Resource> {
  if (!args.name?.trim()) throw new Error('name é obrigatório')
  if (!args.startDate || !args.endDate) throw new Error('startDate e endDate são obrigatórios')
  if (args.startDate > args.endDate) throw new Error('startDate não pode ser posterior a endDate')
  return api(`/projects/${projectId}/sprints`, 'POST', { ...args, name: args.name.trim() }) as Promise<Resource>
}

// Card T24 — traduz `changes` (SET/CLEAR) para o corpo plano das rotas PATCH.
type PlanningChange = { field: string; operation: string; value?: unknown }

function changesToFlatBody(changes: PlanningChange[]): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const change of changes) body[change.field] = change.operation === 'CLEAR' ? null : change.value
  return body
}

export async function toolUpdateSprint(api: ApiCall, projectId: string, sprintId: string, changes: PlanningChange[]): Promise<Resource> {
  return api(`/projects/${projectId}/sprints/${sprintId}`, 'PATCH', changesToFlatBody(changes)) as Promise<Resource>
}

export async function toolActivateSprint(api: ApiCall, projectId: string, sprintId: string): Promise<unknown> {
  return api(`/projects/${projectId}/sprints/${sprintId}/activate`, 'PATCH')
}

export async function toolCloseSprint(api: ApiCall, projectId: string, sprintId: string): Promise<unknown> {
  return api(`/projects/${projectId}/sprints/${sprintId}/close`, 'PATCH')
}

export async function toolListTags(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/tags`) as Promise<Resource[]>
}

export async function toolCreateTag(api: ApiCall, projectId: string, name: string, color?: string): Promise<Resource> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/tags`, 'POST', { name: name.trim(), color }) as Promise<Resource>
}

export async function toolSetItemTags(api: ApiCall, projectId: string, itemId: string, tagIds: string[]): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/tags`, 'POST', { tagIds })
}

export async function toolListVersions(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/versions`) as Promise<Resource[]>
}

export async function toolCreateVersion(api: ApiCall, projectId: string, args: Record<string, unknown>): Promise<Resource> {
  if (typeof args.name !== 'string' || !args.name.trim()) throw new Error('name é obrigatório')
  const { name, ...rest } = args
  const body = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== null && value !== undefined))
  return api(`/projects/${projectId}/versions`, 'POST', { ...body, name: name.trim() }) as Promise<Resource>
}

export async function toolUpdateVersion(api: ApiCall, projectId: string, versionId: string, changes: PlanningChange[]): Promise<Resource> {
  return api(`/projects/${projectId}/versions/${versionId}`, 'PATCH', changesToFlatBody(changes)) as Promise<Resource>
}

export async function toolListMembers(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/members`) as Promise<Resource[]>
}

export async function toolListSquads(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/squads`) as Promise<Resource[]>
}

export async function toolListItemLogs(api: ApiCall, projectId: string, itemId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/logs`)
}

export async function toolCreateItemLog(api: ApiCall, projectId: string, itemId: string, activity: string, durationMin?: number | null): Promise<unknown> {
  if (!activity?.trim()) throw new Error('activity é obrigatório')
  return api(`/projects/${projectId}/items/${itemId}/logs`, 'POST', { activity: activity.trim(), durationMin })
}

export async function toolListCostCenters(api: ApiCall, projectId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/cost-centers`) as Promise<Resource[]>
}

export async function toolCreateCostCenter(api: ApiCall, projectId: string, code: string, description?: string): Promise<Resource> {
  if (!code?.trim()) throw new Error('code é obrigatório')
  return api(`/projects/${projectId}/cost-centers`, 'POST', { code: code.trim(), description }) as Promise<Resource>
}

export async function toolAddMember(api: ApiCall, projectId: string, email: string, role: string, squadId?: string | null): Promise<unknown> {
  if (!email?.trim()) throw new Error('email é obrigatório')
  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) throw new Error('role inválido')
  return api(`/projects/${projectId}/members`, 'POST', { email: email.trim(), role, squadId })
}

export async function toolUpdateMember(api: ApiCall, projectId: string, userId: string, role: string, squadId?: string | null): Promise<unknown> {
  if (!userId?.trim() || !['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) throw new Error('userId e role válidos são obrigatórios')
  return api(`/projects/${projectId}/members/${userId}`, 'PATCH', { role, squadId })
}

export async function toolRemoveMember(api: ApiCall, projectId: string, userId: string): Promise<unknown> {
  return api(`/projects/${projectId}/members/${userId}`, 'DELETE')
}

export async function toolCreateSquad(api: ApiCall, projectId: string, name: string): Promise<Resource> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/squads`, 'POST', { name: name.trim() }) as Promise<Resource>
}

// Card T25 — composição de squad de um membro existente sem alterar o papel.
// `squadId` null limpa a associação (CLEAR) sem remover o membership.
export async function toolSetMemberSquad(api: ApiCall, projectId: string, userId: string, squadId: string | null): Promise<unknown> {
  if (!userId?.trim()) throw new Error('userId é obrigatório')
  return api(`/projects/${projectId}/members/${userId}`, 'PATCH', { squadId })
}

// Card T25 — edições de cadastros. `expected*` são pré-condições internas
// injetadas pela aprovação (não expostas no schema do modelo).
export async function toolUpdateSquad(api: ApiCall, projectId: string, squadId: string, name: string, expectedName?: string | null): Promise<unknown> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/squads/${squadId}`, 'PATCH', { name: name.trim(), ...(expectedName !== undefined ? { expectedName } : {}) })
}

export async function toolUpdateModule(api: ApiCall, projectId: string, moduleId: string, name: string, expectedName?: string | null): Promise<unknown> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  return api(`/projects/${projectId}/modules/${moduleId}`, 'PATCH', { name: name.trim(), ...(expectedName !== undefined ? { expectedName } : {}) })
}

export async function toolUpdateTag(api: ApiCall, projectId: string, tagId: string, patch: { name?: string; color?: string; expectedName?: string | null; expectedColor?: string | null }): Promise<unknown> {
  const body = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
  return api(`/projects/${projectId}/tags/${tagId}`, 'PATCH', body)
}

export async function toolUpdateCostCenter(api: ApiCall, projectId: string, costCenterId: string, patch: { code?: string; description?: string; expectedCode?: string | null }): Promise<unknown> {
  const body = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
  return api(`/projects/${projectId}/cost-centers/${costCenterId}`, 'PATCH', body)
}

export async function toolReorderItems(api: ApiCall, projectId: string, columnId: string, order: string[]): Promise<unknown> {
  if (!columnId || order.length === 0) throw new Error('columnId e order são obrigatórios')
  return api(`/projects/${projectId}/items/reorder`, 'PATCH', { columnId, order })
}

export async function toolListAttachments(api: ApiCall, projectId: string, itemId: string): Promise<Resource[]> {
  return api(`/projects/${projectId}/items/${itemId}/attachments`) as Promise<Resource[]>
}

// Card T23 — leitura autorizada de conteúdo de anexo. `offset` (caractere) permite
// continuar a leitura quando o resultado vier truncado por limite de caracteres.
export async function toolReadAttachment(api: ApiCall, projectId: string, itemId: string, attachmentId: string, offset?: number | null): Promise<unknown> {
  if (!attachmentId?.trim()) throw new Error('attachmentId é obrigatório')
  const query = typeof offset === 'number' && Number.isInteger(offset) && offset > 0 ? `?offset=${offset}` : ''
  return api(`/projects/${projectId}/items/${itemId}/attachments/${attachmentId}/content${query}`)
}

// Card T22 — links externos do item. As mutações ecoam itemId/projectId no
// resultado para confirmação autoexplicativa e invalidação de cache no cliente.
function withLinkTarget(result: unknown, projectId: string, itemId: string): unknown {
  return result && typeof result === 'object' && !Array.isArray(result)
    ? { ...(result as Record<string, unknown>), projectId, itemId }
    : result
}

export async function toolListItemLinks(api: ApiCall, projectId: string, itemId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/links`)
}

export async function toolCreateItemLink(api: ApiCall, projectId: string, itemId: string, name: string, url: string, description?: string | null): Promise<unknown> {
  if (!name?.trim()) throw new Error('name é obrigatório')
  if (!url?.trim()) throw new Error('url é obrigatório')
  const created = await api(`/projects/${projectId}/items/${itemId}/links`, 'POST', { name: name.trim(), url: url.trim(), description })
  return withLinkTarget(created, projectId, itemId)
}

export async function toolUpdateItemLink(api: ApiCall, projectId: string, itemId: string, linkId: string, changes: Record<string, unknown>): Promise<unknown> {
  if (!linkId?.trim()) throw new Error('linkId é obrigatório')
  const updated = await api(`/projects/${projectId}/items/${itemId}/links/${linkId}`, 'PATCH', changes)
  return withLinkTarget(updated, projectId, itemId)
}

export async function toolDeleteItemLink(api: ApiCall, projectId: string, itemId: string, linkId: string): Promise<unknown> {
  if (!linkId?.trim()) throw new Error('linkId é obrigatório')
  await api(`/projects/${projectId}/items/${itemId}/links/${linkId}`, 'DELETE')
  return { ok: true, linkId, itemId, projectId }
}

export async function toolUpdateChecklist(api: ApiCall, projectId: string, itemId: string, checklistId: string, changes: Record<string, unknown>): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}`, 'PATCH', changes)
}

export async function toolDeleteChecklist(api: ApiCall, projectId: string, itemId: string, checklistId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}`, 'DELETE')
}

export async function toolUpdateChecklistItem(api: ApiCall, projectId: string, itemId: string, checklistId: string | undefined, checklistItemId: string | undefined, changes: Record<string, unknown>, semantic?: { checklistName?: string; text?: string; position?: number }): Promise<unknown> {
  if (!checklistId || !checklistItemId) {
    const resolved = await resolveChecklistStep(api, projectId, itemId, semantic?.checklistName, semantic?.text, semantic?.position)
    checklistId = resolved.checklistId
    checklistItemId = resolved.itemId
  }
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items/${checklistItemId}`, 'PATCH', changes)
}

export async function toolDeleteChecklistItem(api: ApiCall, projectId: string, itemId: string, checklistId: string, checklistItemId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items/${checklistItemId}`, 'DELETE')
}

export async function toolUpdateItemLog(api: ApiCall, projectId: string, itemId: string, logId: string, changes: Record<string, unknown>): Promise<unknown> {
  return api(`/projects/${projectId}/items/${itemId}/logs/${logId}`, 'PATCH', changes)
}

// ─── Ferramentas ───────────────────────────────────────────────────────────

export async function toolListTasks(
  api: ApiCall,
  args: { projectId: string; type?: string; sprintId?: string; assigneeId?: string; status?: string; tagIds?: string[]; parentId?: string; columnId?: string; moduleId?: string; onlyLeaves?: boolean; includeDescriptions?: boolean; fields?: string[]; cursor?: string; limit?: number }
): Promise<Item[] | Page<Item>> {
  const { projectId, sprintId, type, assigneeId, status, tagIds, parentId, columnId, moduleId, cursor, limit = 50, onlyLeaves = true, includeDescriptions = false, fields } = args
  const params = new URLSearchParams({ leaf: String(onlyLeaves), limit: String(limit), includeDescriptions: String(includeDescriptions) })
  if (sprintId) params.set('sprintId', sprintId)
  if (type)     params.set('type', type)
  if (assigneeId) params.set('assigneeId', assigneeId)
  if (status) params.set('status', status)
  if (tagIds?.length) params.set('tagIds', tagIds.join(','))
  if (parentId) params.set('parentId', parentId)
  if (columnId) params.set('columnId', columnId)
  if (moduleId) params.set('moduleId', moduleId)
  if (cursor) params.set('cursor', cursor)
  if (fields?.length) params.set('fields', fields.join(','))
  return api(`/projects/${projectId}/items?${params}`) as Promise<Item[] | Page<Item>>
}

export async function toolListModules(api: ApiCall, projectId: string): Promise<Module[]> {
  return api(`/projects/${projectId}/modules`) as Promise<Module[]>
}

export async function toolGetCurrentSprint(api: ApiCall, projectId: string): Promise<unknown> {
  return api(`/projects/${projectId}/sprints/current`)
}

export async function toolClaimTask(api: ApiCall, projectId: string, taskId: string): Promise<unknown> {
  return api(`/projects/${projectId}/items/${taskId}/claim`, 'PATCH')
}

export async function toolMoveTask(
  api: ApiCall,
  projectId: string,
  taskId: string,
  columnName: string
): Promise<unknown> {
  const cols = await api(`/projects/${projectId}/columns`) as Column[]
  const col  = cols.find(c => c.name === columnName)
  if (!col) {
    const available = cols.map(c => `"${c.name}"`).join(', ')
    throw new Error(`Coluna "${columnName}" não encontrada. Colunas disponíveis: ${available}`)
  }
  return api(`/projects/${projectId}/items/${taskId}/move`, 'PATCH', { columnId: col.id })
}

export async function toolCompleteTask(api: ApiCall, projectId: string, taskId: string): Promise<unknown> {
  const item = await api(`/projects/${projectId}/items/${taskId}`) as Item
  if (['TASK', 'BUG'].includes(item.type) && item.isLeaf) {
    const cols    = await api(`/projects/${projectId}/columns`) as Column[]
    const doneCol = cols.find(c => c.baseStatus === 'DONE')
    if (!doneCol) throw new Error('Nenhuma coluna mapeada para DONE no projeto')
    return api(`/projects/${projectId}/items/${taskId}/move`, 'PATCH', { columnId: doneCol.id })
  }
  return api(`/projects/${projectId}/items/${taskId}`, 'PATCH', { status: 'DONE' })
}

export async function toolCreateTask(
  api: ApiCall,
  args: {
    projectId:   string
    title:       string
    type?:       string
    parentId?:   string
    moduleId?:   string
    priority?:   string
    points?:     number
    description?: string
    versionId?: string
    icon?:       string
    color?:      string
  }
): Promise<Item> {
  const { projectId, ...taskData } = args
  const type = (taskData.type ?? 'TASK') as string

  let project: { boardMode?: 'HIERARCHICAL' | 'SIMPLE' } = {}
  try {
    project = await api(`/projects/${projectId}`) as { boardMode?: 'HIERARCHICAL' | 'SIMPLE' }
  } catch {
    // Clientes MCP antigos podem não expor o detalhe do projeto; manter o fluxo hierárquico.
  }
  const isSimpleProject = project.boardMode === 'SIMPLE'

  if (isSimpleProject && (type === 'TASK' || type === 'BUG')) {
    // O backend aponta o card para a STORY fixa; não exigir parentId/moduleId no MCP.
    const { parentId: _ignoredParentId, moduleId: _ignoredModuleId, ...simpleTaskData } = taskData
    return api(`/projects/${projectId}/items`, 'POST', { type, ...simpleTaskData }) as Promise<Item>
  }

  // [HIERARQUIA] Projetos hierárquicos não aceitam TASK/BUG sem pai — o card ficaria invisível no board.
  if ((type === 'TASK' || type === 'BUG') && !taskData.parentId) {
    throw new Error(
      `Hierarquia inválida: ${type} requer parentId apontando para uma STORY, TASK ou BUG.\n` +
      `Use list_tasks com type=STORY para obter as histórias e crie a ${type} sob uma delas.`
    )
  }

  // Pré-validação de hierarquia — fornece erro acionável antes de bater na API
  if (taskData.parentId) {
    let parent: Item
    try {
      parent = await api(`/projects/${projectId}/items/${taskData.parentId}`) as Item
    } catch {
      throw new Error(`parentId "${taskData.parentId}" não encontrado no projeto ${projectId}.`)
    }

    if (type === 'STORY' && parent.type !== 'EPIC') {
      throw new Error(
        `Hierarquia inválida: STORY deve ser filha de EPIC, ` +
        `mas "${parent.title ?? taskData.parentId}" é ${parent.type}.\n` +
        `Use list_tasks com type=EPIC para obter IDs dos EPICs disponíveis.`
      )
    }

    if ((type === 'TASK' || type === 'BUG') && parent.type === 'EPIC') {
      throw new Error(
        `Hierarquia inválida: ${type} não pode ser filho direto de EPIC ("${parent.title ?? taskData.parentId}").\n\n` +
        `Fluxo correto:\n` +
        `  1. Crie uma STORY com parentId="${taskData.parentId}"\n` +
        `  2. Crie a ${type} com parentId=<ID da STORY criada>`
      )
    }
  }

  // EPIC sem moduleId → resolve automaticamente com o primeiro módulo do projeto
  if (type === 'EPIC' && !taskData.moduleId) {
    const mods = await api(`/projects/${projectId}/modules`) as Module[]
    if (mods.length === 0) {
      throw new Error(`O projeto ${projectId} não possui módulos. Crie um módulo antes de criar EPICs.`)
    }
    taskData.moduleId = mods[0]!.id
  }

  return api(`/projects/${projectId}/items`, 'POST', { type, ...taskData }) as Promise<Item>
}

export async function toolListChecklists(
  api: ApiCall,
  projectId: string,
  itemId: string
): Promise<Checklist[]> {
  return api(`/projects/${projectId}/items/${itemId}/checklists`) as Promise<Checklist[]>
}

export async function toolCreateChecklist(
  api: ApiCall,
  projectId: string,
  itemId: string,
  name: string
): Promise<Checklist> {
  return api(`/projects/${projectId}/items/${itemId}/checklists`, 'POST', { name }) as Promise<Checklist>
}

export async function toolAddChecklistItem(
  api: ApiCall,
  projectId: string,
  itemId: string,
  checklistId: string,
  text: string,
  advanced?: { dueDate?: string | null; assigneeId?: string | null; description?: string | null }
): Promise<ChecklistItem> {
  const body: Record<string, unknown> = { text }
  if (advanced?.dueDate !== undefined && advanced.dueDate !== null) body.dueDate = advanced.dueDate
  if (advanced?.assigneeId !== undefined && advanced.assigneeId !== null) body.assigneeId = advanced.assigneeId
  if (advanced?.description !== undefined && advanced.description !== null) body.description = advanced.description
  return api(
    `/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items`,
    'POST',
    body
  ) as Promise<ChecklistItem>
}

export async function toolAddChecklistItemToTask(
  api: ApiCall,
  projectId: string,
  itemId: string,
  checklistName: string,
  text: string,
  advanced?: { dueDate?: string | null; assigneeId?: string | null; description?: string | null }
): Promise<{ checklist: Checklist; item: ChecklistItem }> {
  if (!itemId?.trim()) throw new Error('itemId é obrigatório e deve ser o ID do card pai do checklist')
  if (!checklistName?.trim()) throw new Error('checklistName é obrigatório')
  if (!text?.trim()) throw new Error('text é obrigatório')

  const checklists = await toolListChecklists(api, projectId, itemId)
  let checklist = checklists.find(candidate => candidate.name === checklistName.trim())
  if (!checklist) checklist = await toolCreateChecklist(api, projectId, itemId, checklistName.trim())
  const item = await toolAddChecklistItem(api, projectId, itemId, checklist.id, text.trim(), advanced)
  return { checklist, item }
}

export async function toolCheckItem(
  api: ApiCall,
  projectId: string,
  itemId: string,
  checklistId: string | undefined,
  checklistItemId: string | undefined,
  checked: boolean,
  semantic?: { checklistName?: string; text?: string; position?: number }
): Promise<unknown> {
  if (!checklistId || !checklistItemId) {
    const resolved = await resolveChecklistStep(api, projectId, itemId, semantic?.checklistName, semantic?.text, semantic?.position)
    checklistId = resolved.checklistId
    checklistItemId = resolved.itemId
  }
  return api(
    `/projects/${projectId}/items/${itemId}/checklists/${checklistId}/items/${checklistItemId}`,
    'PATCH',
    { checked }
  )
}

export type CheckItemsEntry = {
  itemId: string
  checklistId?: string | null
  checklistItemId?: string | null
  checklistName?: string | null
  text?: string | null
  position?: number | null
  checked: boolean
}

export async function toolCheckItems(api: ApiCall, projectId: string, entries: CheckItemsEntry[]): Promise<unknown> {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 100) throw new Error('items deve conter entre 1 e 100 entradas')
  const result = { matched: 0, updated: 0, items: [] as Array<Record<string, unknown>>, failures: [] as Array<Record<string, unknown>> }
  const groups = new Map<string, Array<{ entry: CheckItemsEntry; index: number }>>()
  entries.forEach((entry, index) => groups.set(entry.itemId, [...(groups.get(entry.itemId) ?? []), { entry, index }]))

  for (const [itemId, group] of groups) {
    const resolved: Array<{ entry: CheckItemsEntry; index: number; checklistId: string; checklistItemId: string; previous: boolean }> = []
    try {
      const checklists = await toolListChecklists(api, projectId, itemId)
      for (const candidate of group) {
        const { entry } = candidate
        let checklistId = entry.checklistId ?? undefined
        let checklistItemId = entry.checklistItemId ?? undefined
        let previous: boolean | undefined
        if (checklistId && checklistItemId) {
          const checklist = checklists.find(value => value.id === checklistId)
          const step = checklist?.items.find(value => value.id === checklistItemId)
          if (!step) throw new Error(`CHECKLIST_ITEM_NOT_FOUND: item ${candidate.index} não pertence ao card ${itemId}`)
          previous = step.checked
        } else {
          const semantic = await resolveChecklistStep(api, projectId, itemId, entry.checklistName ?? undefined, entry.text ?? undefined, entry.position ?? undefined)
          checklistId = semantic.checklistId
          checklistItemId = semantic.itemId
          const checklist = checklists.find(value => value.id === checklistId)
          previous = checklist?.items.find(value => value.id === checklistItemId)?.checked
        }
        if (!checklistId || !checklistItemId || previous === undefined) throw new Error(`CHECKLIST_ITEM_NOT_FOUND: item ${candidate.index} não foi localizado`)
        resolved.push({ entry, index: candidate.index, checklistId, checklistItemId, previous })
      }

      const applied: typeof resolved = []
      try {
        for (const value of resolved) {
          await api(`/projects/${projectId}/items/${itemId}/checklists/${value.checklistId}/items/${value.checklistItemId}`, 'PATCH', { checked: value.entry.checked })
          applied.push(value)
        }
      } catch (error) {
        await Promise.allSettled(applied.map(value => api(`/projects/${projectId}/items/${itemId}/checklists/${value.checklistId}/items/${value.checklistItemId}`, 'PATCH', { checked: value.previous })))
        throw error
      }
      result.matched += resolved.length
      result.updated += applied.length
      result.items.push(...applied.map(value => ({ index: value.index, itemId, checklistId: value.checklistId, checklistItemId: value.checklistItemId, checked: value.entry.checked })))
    } catch (error) {
      const code = error instanceof Error ? error.message.split(':', 1)[0] : 'CHECK_ITEMS_FAILED'
      const message = error instanceof Error ? error.message : 'Lote rejeitado; nenhuma alteração foi aplicada'
      result.failures.push(...group.map(value => ({ itemId, index: value.index, code, message })))
    }
  }
  return result
}

async function resolveChecklistStep(api: ApiCall, projectId: string, itemId: string, checklistName?: string, text?: string, position?: number): Promise<{ checklistId: string; itemId: string }> {
  const normalized = (value: string) => value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ')
  const checklists = await toolListChecklists(api, projectId, itemId)
  const checklistsByName = checklists.filter(checklist => normalized(checklist.name) === normalized(checklistName ?? ''))
  if (checklistsByName.length !== 1) throw new Error(checklistsByName.length ? `CHECKLIST_AMBIGUOUS: checklistName "${checklistName}" corresponde a ${checklistsByName.length} checklists; informe checklistId` : `CHECKLIST_NOT_FOUND: checklistName "${checklistName}" não existe no card; liste as checklists`)
  const candidates = text === undefined
    ? checklistsByName[0]!.items
    : checklistsByName[0]!.items.filter(step => normalized(step.text) === normalized(text))
  const positioned = position === undefined ? candidates : candidates.filter(step => step.position === position)
  if (positioned.length !== 1) throw new Error(positioned.length ? `CHECKLIST_ITEM_AMBIGUOUS: use checklistItemId ou position; candidatos: ${positioned.map(step => step.id).join(', ')}` : `CHECKLIST_ITEM_NOT_FOUND: ${text === undefined ? `position "${position}"` : `text "${text}"`} não existe em checklistName "${checklistName}"; liste os passos`)
  return { checklistId: checklistsByName[0]!.id, itemId: positioned[0]!.id }
}
