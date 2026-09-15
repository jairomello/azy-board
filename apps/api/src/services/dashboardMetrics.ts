import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { itemEvents, projectAnalyticsCoverage, projectMetricsDaily } from '../db/schema'

// [TENANT] Todas as funções escopam por tenantId + projectId.
// [DB-SWAP] Em PostgreSQL: manter a tabela (ou substituir por materialized view
// com REFRESH); a semantica de deltas permanece válida.

export type RollupExec = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface RollupCounters {
  total: number
  done: number
  points: number
  donePoints: number
}

const ZERO: RollupCounters = { total: 0, done: 0, points: 0, donePoints: 0 }

export type RollupState = { status: string; type: string; isLeaf: boolean; points: number | null }

// Itens folha elegíveis (mesma regra de isEligibleLeaf do Dashboard)
export function isRollupEligible(state: RollupState | null | undefined): boolean {
  if (!state) return false
  return state.isLeaf && (state.type === 'TASK' || state.type === 'BUG') && state.status !== 'ARCHIVED'
}

function isDoneEligible(state: RollupState): boolean {
  return state.status === 'DONE'
}

function snapshotCounters(state: RollupState | null | undefined): RollupCounters {
  if (!state || !isRollupEligible(state)) return ZERO
  const points = state.points ?? 0
  const isDone = isDoneEligible(state)
  return { total: 1, done: isDone ? 1 : 0, points, donePoints: isDone ? points : 0 }
}

// Delta de um evento: saída do estado anterior, entrada do estado novo.
// after null (ou omitido) indica item removido no momento do evento.
function stateDelta(before: RollupState | null, after: RollupState | null): { leave: RollupCounters; enter: RollupCounters } {
  return { leave: before ? snapshotCounters(before) : ZERO, enter: after ? snapshotCounters(after) : ZERO }
}

function addCountersTo(carry: RollupCounters, delta: RollupCounters): RollupCounters {
  return { total: carry.total + delta.total, done: carry.done + delta.done, points: carry.points + delta.points, donePoints: carry.donePoints + delta.donePoints }
}

function negate(delta: RollupCounters): RollupCounters {
  return { total: -delta.total, done: -delta.done, points: -delta.points, donePoints: -delta.donePoints }
}

function parseSnapshot(raw: string | null): RollupState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RollupState> | null
    if (!parsed || typeof parsed !== 'object' || !('status' in parsed)) return null
    return { status: String(parsed.status ?? ''), type: String(parsed.type ?? ''), isLeaf: Boolean(parsed.isLeaf), points: typeof parsed.points === 'number' ? parsed.points : null }
  } catch {
    return null
  }
}

// Carrega o valor do último dia anterior ao alvo (carry forward)
async function loadCarry(exec: RollupExec, tenantId: string, projectId: string, metricDate: string): Promise<RollupCounters> {
  const rows = await exec.select()
    .from(projectMetricsDaily)
    .where(and(
      eq(projectMetricsDaily.tenantId, tenantId),
      eq(projectMetricsDaily.projectId, projectId),
      sql`${projectMetricsDaily.metricDate} < ${metricDate}`,
    ))
    .orderBy(desc(projectMetricsDaily.metricDate))
    .limit(1)
  const row = rows[0]
  if (!row) return ZERO
  return { total: row.total, done: row.done, points: row.points, donePoints: row.donePoints }
}

// Atualização incremental do rollup do dia, na MESMA transação do evento.
// Cobre baseline, ITEM_DELETED, arquiva/desarquiva, STATUS/POINTS/TYPE_CHANGED e LEAF_CHANGED.
export async function applyEventToDailyRollup(
  exec: RollupExec,
  input: {
    tenantId: string
    projectId: string
    eventType: string
    occurredAt: string
    beforeSnapshot: string | null
    afterSnapshot: string | null
  },
): Promise<void> {
  const { tenantId, projectId, eventType, occurredAt } = input
  const metricDate = occurredAt.slice(0, 10)

  if (eventType === 'ANALYTICS_BASELINE') {
    // [TENANT] escopo por tenant/projeto — baseline define valores absolutos do dia
    const rows = JSON.parse(input.afterSnapshot ?? '[]') as Array<{ itemId: string } & RollupState>
    const sums = rows.reduce<RollupCounters>((acc, row) => addCountersTo(acc, snapshotCounters(row)), ZERO)
    await exec.insert(projectMetricsDaily).values({ tenantId, projectId, metricDate, ...sums })
      .onConflictDoUpdate({
        target: [projectMetricsDaily.tenantId, projectMetricsDaily.projectId, projectMetricsDaily.metricDate],
        set: { total: sums.total, done: sums.done, points: sums.points, donePoints: sums.donePoints },
      })
    return
  }

  const before = parseSnapshot(input.beforeSnapshot)
  const after = parseSnapshot(input.afterSnapshot)
  // ITEM_DELETED não tem after: antes sai, nada entra. Os demais usam before→after.
  const { leave, enter } = eventType === 'ITEM_DELETED'
    ? { leave: snapshotCounters(before), enter: ZERO }
    : stateDelta(before, after)

  const net = addCountersTo(enter, negate(leave))
  // Mesmo com delta zero, a linha do dia precisa existir (paridade com o replay
  // por evento) — carry forward preserva os valores do dia anterior.

  const carry = await loadCarry(exec, tenantId, projectId, metricDate)
  const value = addCountersTo(carry, net)
  await exec.insert(projectMetricsDaily).values({ tenantId, projectId, metricDate, ...value })
    .onConflictDoUpdate({
      target: [projectMetricsDaily.tenantId, projectMetricsDaily.projectId, projectMetricsDaily.metricDate],
      // Dia já existente: acumula apenas o delta deste evento sobre os valores vigentes
      set: {
        total: sql`${projectMetricsDaily.total} + ${net.total}`,
        done: sql`${projectMetricsDaily.done} + ${net.done}`,
        points: sql`${projectMetricsDaily.points} + ${net.points}`,
        donePoints: sql`${projectMetricsDaily.donePoints} + ${net.donePoints}`,
      },
    })
}

// Replay completo (backfill tardio e gate anti-drift): reproduz as métricas
// diárias a partir da baseline + eventos. Idempotente — sobrescreve as linhas.
export async function recomputeProjectRollup(exec: RollupExec, tenantId: string, projectId: string): Promise<boolean> {
  const coverage = await exec.query.projectAnalyticsCoverage.findFirst({
    where: (row) => and(eq(row.tenantId, tenantId), eq(row.projectId, projectId)),
  })
  if (!coverage) return false

  const allEvents = await exec.select()
    .from(itemEvents)
    .where(and(eq(itemEvents.tenantId, tenantId), eq(itemEvents.projectId, projectId)))
    .orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))

  const state = new Map<string, RollupState>()
  const byDay = new Map<string, RollupCounters>()
  let baselineSeen = false

  for (const event of allEvents) {
    const day = event.occurredAt.slice(0, 10)
    if (event.eventType === 'ANALYTICS_BASELINE') {
      if (event.afterSnapshot) {
        const rows = JSON.parse(event.afterSnapshot) as Array<{ itemId: string } & RollupState>
        for (const row of rows) state.set(row.itemId, row)
      }
      byDay.set(day, sumState(state))
      baselineSeen = true
      continue
    }
    if (!baselineSeen) continue
    if (event.eventType === 'ITEM_DELETED') {
      if (event.itemId) state.delete(event.itemId)
    } else if (event.itemId && event.afterSnapshot) {
      state.set(event.itemId, JSON.parse(event.afterSnapshot) as RollupState)
    }
    byDay.set(day, sumState(state))
  }

  // Sobrescrever as linhas do projeto com o resultado do replay
  await exec.delete(projectMetricsDaily).where(and(eq(projectMetricsDaily.tenantId, tenantId), eq(projectMetricsDaily.projectId, projectId)))
  if (byDay.size === 0) return true
  for (const page of chunk([...byDay.entries()].map(([metricDate, counters]) => ({ tenantId, projectId, metricDate, ...counters })), 400)) {
    await exec.insert(projectMetricsDaily).values(page).onConflictDoNothing()
  }
  return true
}

function chunk<T>(values: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < values.length; i += size) pages.push(values.slice(i, i + size))
  return pages
}

// Backfill tardio: preenche o rollup de projetos com cobertura e sem rollup
// (replay completo por projeto). Idempotente por projeto.
export async function ensureDashboardRollupsBackfill(): Promise<void> {
  const covered = await db.select({ tenantId: projectAnalyticsCoverage.tenantId, projectId: projectAnalyticsCoverage.projectId })
    .from(projectAnalyticsCoverage)
  for (const coverage of covered) {
    const existing = await db.select({ date: projectMetricsDaily.metricDate })
      .from(projectMetricsDaily)
      .where(and(eq(projectMetricsDaily.tenantId, coverage.tenantId), eq(projectMetricsDaily.projectId, coverage.projectId)))
      .limit(1)
    if (existing.length === 0) {
      await db.transaction(async (tx) => {
        await recomputeProjectRollup(tx, coverage.tenantId, coverage.projectId)
      })
    }
  }
}

// Série diária do burnup sem filtros (leitura direta do rollup)
export async function readDailyRollupSeries(exec: RollupExec, tenantId: string, projectId: string, from: string, to: string): Promise<Map<string, RollupCounters>> {
  const rows = await exec.select()
    .from(projectMetricsDaily)
    .where(and(
      eq(projectMetricsDaily.tenantId, tenantId),
      eq(projectMetricsDaily.projectId, projectId),
      sql`${projectMetricsDaily.metricDate} >= ${from}`,
      sql`${projectMetricsDaily.metricDate} <= ${to}`,
    ))
    .orderBy(asc(projectMetricsDaily.metricDate))
  const byDay = new Map<string, RollupCounters>()
  for (const row of rows) byDay.set(row.metricDate, { total: row.total, done: row.done, points: row.points, donePoints: row.donePoints })
  return byDay
}

// Gate anti-drift: comparativo entre rollup persistido e replay dos eventos
// sobre a mesma base. Usado nos testes de paridade e disponível para auditoria.
export async function rollupMatchesReplay(tenantId: string, projectId: string, from: string, to: string): Promise<boolean> {
  const coverage = await db.query.projectAnalyticsCoverage.findFirst({ where: (row) => and(eq(row.tenantId, tenantId), eq(row.projectId, projectId)) })
  if (!coverage) return true
  const events = await db.select()
    .from(itemEvents)
    .where(and(eq(itemEvents.tenantId, tenantId), eq(itemEvents.projectId, projectId), sql`${itemEvents.occurredAt} >= ${coverage.coverageStartedAt}`))
    .orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  const state = new Map<string, RollupState>()
  const replay = new Map<string, RollupCounters>()
  for (const event of events) {
    const day = event.occurredAt.slice(0, 10)
    if (event.eventType === 'ANALYTICS_BASELINE') {
      if (event.afterSnapshot) {
        const rows = JSON.parse(event.afterSnapshot) as Array<{ itemId: string } & RollupState>
        for (const row of rows) state.set(row.itemId, row)
      }
      replay.set(day, sumState(state))
      continue
    }
    if (event.eventType === 'ITEM_DELETED') {
      if (event.itemId) state.delete(event.itemId)
    } else if (event.itemId && event.afterSnapshot) {
      state.set(event.itemId, JSON.parse(event.afterSnapshot) as RollupState)
    }
    replay.set(day, sumState(state))
  }
  const rollup = await db.select()
    .from(projectMetricsDaily)
    .where(and(eq(projectMetricsDaily.tenantId, tenantId), eq(projectMetricsDaily.projectId, projectId), sql`${projectMetricsDaily.metricDate} >= ${from}`, sql`${projectMetricsDaily.metricDate} <= ${to}`))
    .orderBy(asc(projectMetricsDaily.metricDate))
  for (const row of rollup) {
    const expected = replay.get(row.metricDate) ?? lastCarriedBefore(replay, row.metricDate)
    if (!expected) return false
    if (expected.total !== row.total || expected.done !== row.done || expected.points !== row.points || expected.donePoints !== row.donePoints) return false
  }
  return true
}

function lastCarriedBefore(replay: Map<string, RollupCounters>, metricDate: string): RollupCounters | null {
  let last: RollupCounters | null = null
  for (const [day, counters] of replay) {
    if (day > metricDate) break
    last = counters
  }
  return last
}

function sumState(state: Map<string, RollupState>): RollupCounters {
  const eligible = [...state.values()].filter(row => isRollupEligible(row))
  return {
    total: eligible.length,
    done: eligible.filter(row => isDoneEligible(row)).length,
    points: eligible.reduce((sum, row) => sum + (row.points ?? 0), 0),
    donePoints: eligible.filter(row => isDoneEligible(row)).reduce((sum, row) => sum + (row.points ?? 0), 0),
  }
}
