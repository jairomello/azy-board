/**
 * Seed e runner autenticado para benchmark do Dashboard.
 *
 * Uso (após aplicar migrations em um volume descartável):
 *   DASHBOARD_BENCHMARK_PROFILE=SIMPLE \
 *   DASHBOARD_BENCHMARK_DATABASE_URL=/tmp/azy-dashboard-bench.sqlite \
 *   DASHBOARD_BENCHMARK_INSTANCE_DIR=/tmp/azy-dashboard-bench-instance \
 *   DASHBOARD_BENCHMARK_SEED=referencia-1 \
 *   bun run --cwd apps/api src/scripts/dashboard-benchmark.ts seed
 *
 * ADVANCED requer DATABASE_URL PostgreSQL, REDIS_URL Valkey/Redis e volume com
 * migrations/marcadores do perfil. Nunca usa DATABASE_URL de fallback: o URL
 * de benchmark precisa ser informado explicitamente.
 */
import { createHash, randomUUID } from 'node:crypto'
import { cpus, totalmem } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PersistencePorts } from '../persistence/ports'
import type { ItemWithRelationsRecord, MutationContext, PersistenceContext } from '../persistence/models'
import { generateId } from '../utils/id'

type Profile = 'SIMPLE' | 'ADVANCED'
type BenchmarkManifest = {
  format: 1
  profile: Profile
  seed: string
  tenantId: string
  projectId: string
  userId: string
  email: string
  moduleId: string
  versionId: string
  sprintId: string
  cycleId: string
  squadId: string
  coverageStartedAt: string
  leaves: number
  aggregators: number
  events: number
}

type Snapshot = {
  itemId: string
  parentId: string | null
  type: string
  isLeaf: boolean
  status: string
  points: number | null
  sprintIds: string[]
  versionId: string | null
  moduleId: string | null
}

type EventRow = {
  id: string
  tenantId: string
  projectId: string
  itemId: string | null
  eventType: string
  occurredAt: string
  sequence: number
  actorId: string
  origin: string
  correlationId: string
  beforeSnapshot: string | null
  afterSnapshot: string | null
}

const profile = process.env.DASHBOARD_BENCHMARK_PROFILE as Profile | undefined
const databaseUrl = process.env.DASHBOARD_BENCHMARK_DATABASE_URL
const instanceDir = process.env.DASHBOARD_BENCHMARK_INSTANCE_DIR
const configuredSeed = process.env.DASHBOARD_BENCHMARK_SEED
const manifestPath = resolve(process.env.DASHBOARD_BENCHMARK_MANIFEST ?? './artifacts/dashboard-benchmark/manifest.json')

function assertSeedEnvironment(): void {
  if (profile !== 'SIMPLE' && profile !== 'ADVANCED') throw new Error('DASHBOARD_BENCHMARK_PROFILE deve ser SIMPLE ou ADVANCED.')
  if (!databaseUrl) throw new Error('Informe DASHBOARD_BENCHMARK_DATABASE_URL apontando para um banco descartável exclusivo do benchmark.')
  if (!instanceDir) throw new Error('Informe DASHBOARD_BENCHMARK_INSTANCE_DIR para um diretório descartável exclusivo do benchmark.')
  if (!configuredSeed || !/^[\w.-]{1,64}$/.test(configuredSeed)) throw new Error('DASHBOARD_BENCHMARK_SEED deve conter 1–64 caracteres alfanuméricos, ponto, hífen ou sublinhado.')
  if (profile === 'ADVANCED' && !process.env.DASHBOARD_BENCHMARK_REDIS_URL) throw new Error('ADVANCED exige DASHBOARD_BENCHMARK_REDIS_URL exclusivo do ambiente descartável.')
  if (profile === 'SIMPLE' && /^(postgres|postgresql|redis|rediss):\/\//.test(databaseUrl)) throw new Error('SIMPLE exige um caminho SQLite descartável, não uma URL de serviço.')
  if (profile === 'ADVANCED' && !/^postgres(ql)?:\/\//.test(databaseUrl)) throw new Error('ADVANCED exige um URL PostgreSQL dedicado.')
}

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} deve ser inteiro entre ${min} e ${max}.`)
  return value
}

function seedHash(value: string): number {
  return createHash('sha256').update(value).digest().readUInt32BE(0)
}

function deterministicChoice(seedValue: string, index: number, modulo: number): number {
  let value = (seedHash(seedValue) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5
  return (value >>> 0) % modulo
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000)
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function newMutationContext(tenantId: string, userId: string): MutationContext {
  return {
    tenantId,
    actorUserId: userId,
    actorKind: 'USER',
    globalGroup: 'ADMIN',
    mutation: { origin: 'BENCHMARK', actorType: 'HUMAN', actorSource: 'SYSTEM', actorLabel: 'dashboard-benchmark' },
  }
}

function newSystemContext(tenantId: string): PersistenceContext {
  return { tenantId, actorUserId: null, actorKind: 'SYSTEM' }
}

async function openPersistence() {
  process.env.AZYBOARD_INSTALL_PROFILE = profile
  process.env.DATABASE_URL = databaseUrl
  process.env.AZYBOARD_INSTANCE_DIR = instanceDir
  if (profile === 'ADVANCED') process.env.REDIS_URL = process.env.DASHBOARD_BENCHMARK_REDIS_URL
  const runtime = await import('../persistence/runtime')
  const boot = await runtime.bootstrapRuntime()
  if (runtime.installProfile.profile !== profile) throw new Error(`Perfil aberto (${runtime.installProfile.profile}) diferente do solicitado (${profile}).`)
  return { ...runtime, boot }
}

async function createMainFixture(ports: PersistencePorts, profileName: Profile, seedValue: string, leafCount: number, aggregatorCount: number) {
  const tag = `${profileName.toLowerCase()}-${seedHash(seedValue).toString(16).padStart(8, '0')}-${randomUUID().slice(0, 8)}`
  const tenant = await ports.tenants.createTenant({ name: `Dashboard benchmark ${seedValue}`, slug: `dash-bench-${tag}` })
  const system = newSystemContext(tenant.id)
  const email = `dashboard-benchmark-${tag}@example.invalid`
  const user = await ports.identity.createUser(system, {
    email,
    passwordHash: createHash('sha256').update(randomUUID()).digest('hex'),
    name: 'Usuário de benchmark',
    globalGroup: 'ADMIN',
  })
  const mutation = newMutationContext(tenant.id, user.id)
  const project = await ports.unitOfWork.createProjectAggregate(mutation, {
    project: { name: `Dashboard benchmark ${seedValue}`, boardMode: 'HIERARCHICAL', description: `Fixture descartável; seed=${seedValue}; profile=${profileName}.` },
    defaultColumns: [
      { name: 'A Fazer', baseStatus: 'NOT_STARTED' },
      { name: 'Fazendo', baseStatus: 'IN_PROGRESS' },
      { name: 'Concluídas', baseStatus: 'DONE' },
    ],
    defaultModuleName: 'Benchmark',
    simpleStoryTitle: 'Fluxo de benchmark',
  })

  const moduleCount = profileName === 'SIMPLE' ? 8 : 16
  const modules = [
    ...await ports.projects.listModules(system, project.id),
    ...await Promise.all(Array.from({ length: moduleCount - 1 }, (_, index) => ports.projects.createModule(system, project.id, { name: `Área ${String(index + 2).padStart(2, '0')}` }))),
  ]
  const versions = await Promise.all(Array.from({ length: 6 }, (_, index) => ports.planning.createVersion(system, project.id, {
    name: `Release ${index + 1}`,
    status: index === 0 ? 'IN_DEV' : 'PLANNED',
    releaseDate: dateOnly(addDays(new Date(), 30 + index * 30)),
    position: index,
  })))
  const now = new Date()
  const sprints = await Promise.all(Array.from({ length: 8 }, (_, index) => {
    const start = addDays(now, (index - 3) * 14)
    return ports.planning.createSprint(system, project.id, {
      name: `Sprint ${index + 1}`,
      status: index < 3 ? 'CLOSED' : index === 3 ? 'OPEN' : 'PROPOSED',
      startDate: dateOnly(start),
      endDate: dateOnly(addDays(start, 13)),
    })
  }))
  const squad = await ports.projects.createSquad(system, project.id, { name: 'Benchmark' })
  await ports.projects.updateProjectMember(system, project.id, user.id, { squadId: squad.id })

  const storyCount = Math.ceil(leafCount / 10)
  if (aggregatorCount !== storyCount * 2) throw new Error(`A quantidade deve formar agregadores EPIC/STORY: esperado ${storyCount * 2}, recebido ${aggregatorCount}.`)
  const batchSize = 48
  const leafIds: string[] = []
  let groupStart = 0
  while (groupStart < storyCount) {
    const operations = [] as Array<{
      tool: string; title: string; type: 'EPIC' | 'STORY' | 'TASK'; ref: string; parentRef?: string
      moduleId?: string; points?: number | null; priority?: 'LOW' | 'MEDIUM' | 'HIGH'; assignToCurrentUser?: boolean
      versionId?: string; sprintIds?: string[]
    }>
    const groupEnd = Math.min(storyCount, groupStart + Math.floor(batchSize / 12))
    for (let group = groupStart; group < groupEnd; group += 1) {
      const epicRef = `epic-${group}`
      const storyRef = `story-${group}`
      const module = modules[group % modules.length]!
      operations.push({ tool: 'create_task', title: `Épico ${group + 1}`, type: 'EPIC', ref: epicRef, moduleId: module.id })
      operations.push({ tool: 'create_task', title: `História ${group + 1}`, type: 'STORY', ref: storyRef, parentRef: epicRef })
      for (let offset = 0; offset < 10 && group * 10 + offset < leafCount; offset += 1) {
        const index = group * 10 + offset
        const version = versions[deterministicChoice(seedValue, index, versions.length)]!
        const sprintA = sprints[deterministicChoice(seedValue, index, sprints.length)]!
        const sprintB = sprints[(deterministicChoice(`${seedValue}:secondary`, index, sprints.length))]!
        operations.push({
          tool: 'create_task', title: `Tarefa ${String(index + 1).padStart(6, '0')}`, type: 'TASK',
          ref: `task-${index}`, parentRef: storyRef, moduleId: modules[deterministicChoice(seedValue, index, modules.length)]!.id,
          points: index % 5 === 0 ? null : 1 + deterministicChoice(seedValue, index + 100, 13),
          priority: index % 17 === 0 ? 'HIGH' : 'MEDIUM',
          assignToCurrentUser: index % 4 === 0,
          versionId: version.id,
          sprintIds: sprintA.id === sprintB.id ? [sprintA.id] : [sprintA.id, sprintB.id],
        })
      }
    }
    const result = await ports.unitOfWork.createItemsBatch(mutation, project.id, operations, { atomic: true })
    const failures = result.results.filter(row => !row.ok)
    if (failures.length) throw new Error(`Falha ao criar batch de benchmark: ${JSON.stringify(failures.slice(0, 3))}`)
    for (const row of result.results) if (row.data?.type === 'TASK') leafIds.push(row.data.id)
    groupStart = groupEnd
    if (groupStart % 1000 === 0 || groupStart === storyCount) console.log(`Seed ${profileName}: grupos ${groupStart}/${storyCount}; folhas ${leafIds.length}/${leafCount}.`)
  }

  const columns = await ports.projects.listColumns(system, project.id)
  const statusColumn = {
    NOT_STARTED: columns.find(column => column.baseStatus === 'NOT_STARTED')?.id,
    IN_PROGRESS: columns.find(column => column.baseStatus === 'IN_PROGRESS')?.id,
    DONE: columns.find(column => column.baseStatus === 'DONE')?.id,
  }
  if (!statusColumn.NOT_STARTED || !statusColumn.IN_PROGRESS || !statusColumn.DONE) throw new Error('O projeto do benchmark precisa das três colunas-base.')
  const updates: Array<{ itemId: string; patch: { status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'; columnId: string; dueDate?: string }; changedFields: string[] }> = []
  for (const [index, itemId] of leafIds.entries()) {
    const bucket = deterministicChoice(seedValue, index, 100)
    const status = bucket < 4 ? 'DONE' : bucket < 9 ? 'IN_PROGRESS' : bucket < 12 ? 'BLOCKED' : 'NOT_STARTED'
    const patch: { status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'; columnId: string; dueDate?: string } = {
      status,
      columnId: status === 'DONE' ? statusColumn.DONE : status === 'NOT_STARTED' ? statusColumn.NOT_STARTED : statusColumn.IN_PROGRESS,
    }
    const fields = ['status']
    if (bucket >= 12 && bucket < 17) {
      patch.dueDate = dateOnly(addDays(now, -1 - deterministicChoice(seedValue, index + 900, 90)))
      fields.push('dueDate')
    }
    if (status !== 'NOT_STARTED' || patch.dueDate) updates.push({ itemId, patch, changedFields: fields })
  }
  for (let offset = 0; offset < updates.length; offset += 50) {
    await ports.unitOfWork.applyItemBatch(mutation, project.id, updates.slice(offset, offset + 50))
  }

  const cycleId = randomUUID()
  const sprint = sprints[3]!
  const manifestBase = {
    profile: profileName,
    seed: seedValue,
    tenantId: tenant.id,
    projectId: project.id,
    userId: user.id,
    email,
    moduleId: modules[0]!.id,
    versionId: versions[0]!.id,
    sprintId: sprint.id,
    cycleId,
    squadId: squad.id,
    leaves: leafCount,
    aggregators: aggregatorCount,
  }
  return { tenant, user, project, modules, versions, sprints, squad, leafIds, manifestBase, cycleId }
}

function makeSqlRows(rows: unknown[][], dialect: Profile, columns: number): { text: string; values: unknown[] } {
  const values = rows.flat()
  const marker = (index: number) => dialect === 'ADVANCED' ? `$${index}` : '?'
  const tuples = rows.map((_, row) => `(${Array.from({ length: columns }, (_unused, column) => marker(row * columns + column + 1)).join(',')})`)
  return { text: tuples.join(','), values }
}

async function insertEvents(profileName: Profile, database: { sqlite?: { query(sql: string): { run(...values: unknown[]): unknown } }; pool?: { query(sql: string, values?: unknown[]): Promise<unknown> } }, rows: EventRow[]) {
  if (!rows.length) return
  const fields = 'id,tenant_id,project_id,item_id,event_type,occurred_at,sequence,actor_id,origin,correlation_id,before_snapshot,after_snapshot'
  const pageSize = profileName === 'SIMPLE' ? 50 : 500
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    const page = rows.slice(offset, offset + pageSize)
    const sqlRows = page.map(row => [row.id, row.tenantId, row.projectId, row.itemId, row.eventType, row.occurredAt, row.sequence, row.actorId, row.origin, row.correlationId, row.beforeSnapshot, row.afterSnapshot])
    const values = makeSqlRows(sqlRows, profileName, 12)
    const query = `INSERT INTO item_events (${fields}) VALUES ${values.text}`
    if (profileName === 'SIMPLE') database.sqlite!.query(query).run(...values.values)
    else await database.pool!.query(query, values.values)
  }
}

async function insertWorkLogs(profileName: Profile, database: { sqlite?: { query(sql: string): { run(...values: unknown[]): unknown } }; pool?: { query(sql: string, values?: unknown[]): Promise<unknown> } }, rows: unknown[][]) {
  const fields = 'id,tenant_id,item_id,author_id,type,actor_type,actor_label,source,activity,duration_min,created_at,updated_at'
  const pageSize = profileName === 'SIMPLE' ? 50 : 500
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    const values = makeSqlRows(rows.slice(offset, offset + pageSize), profileName, 12)
    const query = `INSERT INTO item_logs (${fields}) VALUES ${values.text}`
    if (profileName === 'SIMPLE') database.sqlite!.query(query).run(...values.values)
    else await database.pool!.query(query, values.values)
  }
}

async function replaceHistory(profileName: Profile, seedValue: string, database: { sqlite?: { query(sql: string): { run(...values: unknown[]): unknown } }; pool?: { query(sql: string, values?: unknown[]): Promise<{ rows?: Array<Record<string, unknown>> }> } }, fixture: Awaited<ReturnType<typeof createMainFixture>>, snapshotRows: Snapshot[], eventCount: number, start: Date, end: Date) {
  const { tenant, project, user, manifestBase, cycleId } = fixture
  const eligible = snapshotRows.filter(row => row.isLeaf && (row.type === 'TASK' || row.type === 'BUG') && row.status !== 'ARCHIVED')
  const totals = {
    total: eligible.length,
    done: eligible.filter(row => row.status === 'DONE').length,
    points: eligible.reduce((sum, row) => sum + (row.points ?? 0), 0),
    donePoints: eligible.filter(row => row.status === 'DONE').reduce((sum, row) => sum + (row.points ?? 0), 0),
  }
  const baselineId = generateId()
  const baseline: EventRow = {
    id: baselineId, tenantId: tenant.id, projectId: project.id, itemId: null,
    eventType: 'ANALYTICS_BASELINE', occurredAt: start.toISOString(), sequence: 0, actorId: user.id,
    origin: 'BENCHMARK', correlationId: `dashboard-benchmark-${seedValue}-baseline`, beforeSnapshot: null,
    afterSnapshot: JSON.stringify(snapshotRows),
  }
  const baseInsert = async () => {
    const coverage = profileName === 'SIMPLE'
      ? `UPDATE project_analytics_coverage SET coverage_started_at=?, baseline_event_id=? WHERE tenant_id=? AND project_id=?`
      : `UPDATE project_analytics_coverage SET coverage_started_at=$1, baseline_event_id=$2 WHERE tenant_id=$3 AND project_id=$4`
    const clearEvents = profileName === 'SIMPLE'
      ? `DELETE FROM item_events WHERE tenant_id=? AND project_id=?`
      : `DELETE FROM item_events WHERE tenant_id=$1 AND project_id=$2`
    const clearDaily = profileName === 'SIMPLE'
      ? `DELETE FROM project_metrics_daily WHERE tenant_id=? AND project_id=?`
      : `DELETE FROM project_metrics_daily WHERE tenant_id=$1 AND project_id=$2`
    const clearDimensionTable = (table: string) => profileName === 'SIMPLE'
      ? `DELETE FROM ${table} WHERE tenant_id=? AND project_id=?`
      : `DELETE FROM ${table} WHERE tenant_id=$1 AND project_id=$2`
    const clearDimensionMeta = profileName === 'SIMPLE'
      ? `UPDATE project_analytics_dimension_meta SET status='BUILDING', projection_version=1, last_sequence=-1, target_sequence=NULL, updated_at=? WHERE tenant_id=? AND project_id=?`
      : `UPDATE project_analytics_dimension_meta SET status='BUILDING', projection_version=1, last_sequence=-1, target_sequence=NULL, updated_at=$1 WHERE tenant_id=$2 AND project_id=$3`
    if (profileName === 'SIMPLE') {
      database.sqlite!.query(clearEvents).run(tenant.id, project.id)
      database.sqlite!.query(clearDaily).run(tenant.id, project.id)
      for (const table of ['project_analytics_dimension_state', 'project_analytics_dimension_snapshots', 'project_analytics_dimension_items']) database.sqlite!.query(clearDimensionTable(table)).run(tenant.id, project.id)
      database.sqlite!.query(clearDimensionMeta).run(new Date().toISOString(), tenant.id, project.id)
      database.sqlite!.query(coverage).run(start.toISOString(), baselineId, tenant.id, project.id)
    } else {
      await database.pool!.query(clearEvents, [tenant.id, project.id])
      await database.pool!.query(clearDaily, [tenant.id, project.id])
      for (const table of ['project_analytics_dimension_state', 'project_analytics_dimension_snapshots', 'project_analytics_dimension_items']) await database.pool!.query(clearDimensionTable(table), [tenant.id, project.id])
      await database.pool!.query(clearDimensionMeta, [new Date().toISOString(), tenant.id, project.id])
      await database.pool!.query(coverage, [start.toISOString(), baselineId, tenant.id, project.id])
    }
    await insertEvents(profileName, database, [baseline])
    const dailyRows: unknown[][] = []
    for (let date = new Date(`${dateOnly(start)}T00:00:00.000Z`); date <= end; date = addDays(date, 1)) {
      dailyRows.push([tenant.id, project.id, dateOnly(date), totals.total, totals.done, totals.points, totals.donePoints])
    }
    const dailyColumns = 'tenant_id,project_id,metric_date,total,done,points,done_points'
    const dailyPageSize = profileName === 'SIMPLE' ? 100 : 500
    for (let offset = 0; offset < dailyRows.length; offset += dailyPageSize) {
      const page = dailyRows.slice(offset, offset + dailyPageSize)
      const values = makeSqlRows(page, profileName, 7)
      const query = `INSERT INTO project_metrics_daily (${dailyColumns}) VALUES ${values.text}`
      if (profileName === 'SIMPLE') database.sqlite!.query(query).run(...values.values)
      else await database.pool!.query(query, values.values)
    }

    const logRows = eligible.filter((_row, index) => index % 5 === 0).map((row, index) => {
      const createdAt = new Date(start.getTime() + Math.floor((index / Math.max(1, Math.ceil(eligible.length / 5))) * (end.getTime() - start.getTime()))).toISOString()
      return [generateId(), tenant.id, row.itemId, user.id, 'manual', 'HUMAN', 'dashboard-benchmark', 'SYSTEM', `Benchmark worklog ${index + 1}`, 15 + deterministicChoice(seedValue, index, 106), createdAt, createdAt]
    })
    await insertWorkLogs(profileName, database, logRows)

    // Eventos em pares no mesmo dia alternam a conclusão e retornam ao estado
    // original, preservando a fotografia final de cada data e cobrindo 366 dias.
    const syntheticCount = eventCount - 1
    const pairs = Math.floor(syntheticCount / 2)
    const pageSize = profileName === 'SIMPLE' ? 50 : 500
    const coverageDayStart = Date.parse(`${dateOnly(start)}T00:00:00.000Z`)
    const endDayStart = Date.parse(`${dateOnly(end)}T00:00:00.000Z`)
    const dayCount = Math.max(1, Math.round((endDayStart - coverageDayStart) / 86400000) + 1)
    let sequence = 1
    let staged: EventRow[] = []
    for (let pair = 0; pair < pairs; pair += 1) {
      const item = eligible[deterministicChoice(seedValue, pair, eligible.length)]
      if (!item) continue
      const changedStatus = item.status === 'DONE' ? 'NOT_STARTED' : 'DONE'
      const toggled = { ...item, status: changedStatus }
      const dayIndex = Math.min(dayCount - 1, Math.floor(pair * dayCount / pairs))
      const firstPairInDay = Math.ceil(dayIndex * pairs / dayCount)
      const afterLastPairInDay = Math.ceil((dayIndex + 1) * pairs / dayCount)
      const pairsInDay = Math.max(1, afterLastPairInDay - firstPairInDay)
      const pairInDay = pair - firstPairInDay
      const occurredAtMs = dayIndex === dayCount - 1
        ? end.getTime() - (pairsInDay - pairInDay) * 2000
        : coverageDayStart + dayIndex * 86400000 + pairInDay * 2000
      const occurredAt = new Date(occurredAtMs)
      const firstAt = occurredAt.toISOString()
      const secondAt = new Date(occurredAt.getTime() + 1000).toISOString()
      const before = JSON.stringify(item)
      const after = JSON.stringify(toggled)
      staged.push({
        id: generateId(), tenantId: tenant.id, projectId: project.id, itemId: item.itemId,
        eventType: 'STATUS_CHANGED', occurredAt: firstAt, sequence: sequence++, actorId: user.id,
        origin: 'BENCHMARK', correlationId: `dashboard-benchmark-${seedValue}-${sequence}`, beforeSnapshot: before, afterSnapshot: after,
      })
      staged.push({
        id: generateId(), tenantId: tenant.id, projectId: project.id, itemId: item.itemId,
        eventType: 'STATUS_CHANGED', occurredAt: secondAt, sequence: sequence++, actorId: user.id,
        origin: 'BENCHMARK', correlationId: `dashboard-benchmark-${seedValue}-${sequence}`, beforeSnapshot: after, afterSnapshot: before,
      })
      if (staged.length >= pageSize) {
        await insertEvents(profileName, database, staged)
        staged = []
      }
      if ((pair + 1) % 100000 === 0) console.log(`Histórico sintético: ${pair + 1}/${pairs} pares.`)
    }
    if (syntheticCount % 2 === 1) {
      const item = eligible[0]
      if (item) {
        const snapshot = JSON.stringify(item)
        staged.push({ id: generateId(), tenantId: tenant.id, projectId: project.id, itemId: item.itemId, eventType: 'STATUS_CHANGED', occurredAt: end.toISOString(), sequence: sequence++, actorId: user.id, origin: 'BENCHMARK', correlationId: `dashboard-benchmark-${seedValue}-${sequence}`, beforeSnapshot: snapshot, afterSnapshot: snapshot })
      }
    }
    if (staged.length) await insertEvents(profileName, database, staged)

    // Ciclo ativo com todos os cards vinculados à sprint, para medir o endpoint
    // de ciclo sem hidratar uma resposta artificialmente vazia.
    const sprintId = manifestBase.sprintId
    const insertCycle = profileName === 'SIMPLE'
      ? `INSERT INTO sprint_cycles (id,tenant_id,project_id,sprint_id,started_at,ended_at,end_reason,source) VALUES (?,?,?,?,?,NULL,NULL,'OPENED')`
      : `INSERT INTO sprint_cycles (id,tenant_id,project_id,sprint_id,started_at,ended_at,end_reason,source) VALUES ($1,$2,$3,$4,$5,NULL,NULL,'OPENED')`
    const cycleStartedAt = start.toISOString()
    if (profileName === 'SIMPLE') database.sqlite!.query(insertCycle).run(cycleId, tenant.id, project.id, sprintId, cycleStartedAt)
    else await database.pool!.query(insertCycle, [cycleId, tenant.id, project.id, sprintId, cycleStartedAt])
    const cycleItems = eligible.filter(row => row.sprintIds.includes(sprintId))
    const cycleFields = 'cycle_id,tenant_id,project_id,item_id,type,is_leaf,points,status,module_id,version_id'
    const cyclePageSize = profileName === 'SIMPLE' ? 50 : 500
    for (let offset = 0; offset < cycleItems.length; offset += cyclePageSize) {
      const page = cycleItems.slice(offset, offset + cyclePageSize)
      const values = makeSqlRows(page.map(row => [cycleId, tenant.id, project.id, row.itemId, row.type, row.isLeaf ? 1 : 0, row.points, row.status, row.moduleId, row.versionId]), profileName, 10)
      const query = `INSERT INTO sprint_cycle_items (${cycleFields}) VALUES ${values.text}`
      if (profileName === 'SIMPLE') database.sqlite!.query(query).run(...values.values)
      else await database.pool!.query(query, values.values)
    }
  }

  if (profileName === 'SIMPLE') await baseInsert()
  else {
    await database.pool!.query('BEGIN')
    try { await baseInsert(); await database.pool!.query('COMMIT') }
    catch (error) { await database.pool!.query('ROLLBACK'); throw error }
  }

  const endIso = end.toISOString()
  const manifest: BenchmarkManifest = {
    format: 1, ...manifestBase, cycleId,
    coverageStartedAt: start.toISOString(), events: eventCount,
  }
  await mkdir(dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify({ status: 'seeded', manifest: manifestPath, end: endIso, leaves: manifest.leaves, aggregators: manifest.aggregators, events: eventCount, filters: { moduleId: manifest.moduleId, versionId: manifest.versionId, sprintId: manifest.sprintId, squadId: manifest.squadId } }, null, 2))
  return manifest
}

async function seed() {
  assertSeedEnvironment()
  const profileName = profile as Profile
  const seedValue = configuredSeed!
  const leaves = integerEnv('DASHBOARD_BENCHMARK_LEAVES', profileName === 'SIMPLE' ? 10_000 : 100_000, 10, 100_000)
  const aggregators = integerEnv('DASHBOARD_BENCHMARK_AGGREGATORS', profileName === 'SIMPLE' ? 2_000 : 20_000, 2, 20_000)
  const events = integerEnv('DASHBOARD_BENCHMARK_EVENTS', profileName === 'SIMPLE' ? 100_000 : 1_000_000, 1, 1_000_000)
  const runtime = await openPersistence()
  let database: { sqlite?: { query(sql: string): { run(...values: unknown[]): unknown } }; pool?: { query(sql: string, values?: unknown[]): Promise<{ rows?: Array<Record<string, unknown>> }> } } = {}
  try {
    if (profileName === 'SIMPLE') {
      const simple = await import('../db/index')
      database.sqlite = simple.sqlite
    } else {
      const { createPostgresPool } = await import('../db/postgres/index')
      database.pool = createPostgresPool(runtime.installProfile)
      await database.pool.query('SELECT 1')
    }
    const fixture = await createMainFixture(runtime.persistence, profileName, seedValue, leaves, aggregators)

    // Fixture secundária mínima em outro tenant: protege os testes de filtro de
    // escopo sem misturar sua população ou histórico ao projeto medido.
    const otherTenant = await runtime.persistence.tenants.createTenant({ name: `Isolamento ${seedValue}`, slug: `dash-isolation-${profileName.toLowerCase()}-${seedHash(seedValue).toString(16)}-${randomUUID().slice(0, 6)}` })
    const otherUser = await runtime.persistence.identity.createUser(newSystemContext(otherTenant.id), {
      email: `dashboard-isolation-${randomUUID()}@example.invalid`, passwordHash: createHash('sha256').update(randomUUID()).digest('hex'), name: 'Isolamento', globalGroup: 'ADMIN',
    })
    await runtime.persistence.unitOfWork.createProjectAggregate(newMutationContext(otherTenant.id, otherUser.id), {
      project: { name: `Isolamento ${seedValue}`, boardMode: 'SIMPLE' },
      defaultColumns: [{ name: 'A Fazer', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'Geral', simpleStoryTitle: 'Fluxo',
    })

    const snapshotItems = await runtime.persistence.items.listItemsWithRelations({ tenantId: fixture.tenant.id, actorUserId: fixture.user.id, actorKind: 'USER' }, fixture.project.id)
    const parentIds = new Set(snapshotItems.flatMap(row => row.parentId ? [row.parentId] : []))
    const snapshots: Snapshot[] = snapshotItems.map((row: ItemWithRelationsRecord) => ({
      itemId: row.id, parentId: row.parentId, type: row.type, isLeaf: !parentIds.has(row.id), status: row.status,
      points: row.points, sprintIds: row.itemSprints.map(sprint => sprint.sprintId), versionId: row.versionId, moduleId: row.moduleId,
    }))
    const coverageStart = addDays(new Date(`${dateOnly(new Date())}T00:00:00.000Z`), -364)
    const manifest = await replaceHistory(profileName, seedValue, database, fixture, snapshots, events, coverageStart, new Date())
    void manifest
  } finally {
    if (database.pool) await (database.pool as { end?: () => Promise<void> }).end?.()
    await runtime.closeRuntime()
  }
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)]!
}

async function queryPlans(profileName: Profile, tenantId: string, projectId: string) {
  if (profileName === 'SIMPLE') {
    const { sqlite } = await import('../db/index')
    const version = sqlite.query('SELECT sqlite_version() AS version').get() as { version: string }
    const leaf = sqlite.query(`EXPLAIN QUERY PLAN SELECT i.id FROM items i WHERE i.tenant_id=? AND i.project_id=? AND i.type IN ('TASK','BUG') AND i.status <> 'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=i.tenant_id AND child.project_id=i.project_id AND child.parent_id=i.id) ORDER BY i.id LIMIT 50`).all(tenantId, projectId)
    const snapshot = sqlite.query(`EXPLAIN QUERY PLAN SELECT i.status,i.assignee_id,COUNT(*),COUNT(i.points),SUM(i.points) FROM items i WHERE i.tenant_id=? AND i.project_id=? AND i.type IN ('TASK','BUG') AND i.status <> 'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=i.tenant_id AND child.project_id=i.project_id AND child.parent_id=i.id) GROUP BY i.status,i.assignee_id`).all(tenantId, projectId)
    const aging = sqlite.query(`EXPLAIN QUERY PLAN SELECT i.id,COALESCE((SELECT e.occurred_at FROM item_events e WHERE e.tenant_id=? AND e.project_id=? AND e.item_id=i.id AND e.event_type='STATUS_CHANGED' AND json_valid(e.after_snapshot) AND json_extract(e.after_snapshot,'$.status') IN ('IN_PROGRESS','BLOCKED') AND COALESCE(CASE WHEN json_valid(e.before_snapshot) THEN json_extract(e.before_snapshot,'$.status') ELSE NULL END,'') NOT IN ('IN_PROGRESS','BLOCKED') ORDER BY e.occurred_at DESC,e.sequence DESC,e.id DESC LIMIT 1),(SELECT coverage_started_at FROM project_analytics_coverage WHERE tenant_id=? AND project_id=?),i.created_at) AS started_at FROM items i WHERE i.tenant_id=? AND i.project_id=? AND i.type IN ('TASK','BUG') AND i.status IN ('IN_PROGRESS','BLOCKED') AND i.status <> 'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=i.tenant_id AND child.project_id=i.project_id AND child.parent_id=i.id) ORDER BY started_at,i.id LIMIT 51`).all(tenantId, projectId, tenantId, projectId, tenantId, projectId)
    const history = sqlite.query(`EXPLAIN QUERY PLAN SELECT id FROM item_events WHERE tenant_id=? AND project_id=? AND occurred_at>=? AND occurred_at<=? ORDER BY occurred_at,sequence LIMIT 100`).all(tenantId, projectId, '2020-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z')
    const hours = sqlite.query(`EXPLAIN QUERY PLAN SELECT l.id FROM item_logs l JOIN items i ON i.tenant_id=l.tenant_id AND i.id=l.item_id WHERE l.tenant_id=? AND i.project_id=? AND l.type='manual' AND l.duration_min>0 ORDER BY l.created_at,l.id LIMIT 50`).all(tenantId, projectId)
    const rollup = sqlite.query('EXPLAIN QUERY PLAN SELECT metric_date,total,done,points,done_points FROM project_metrics_daily WHERE tenant_id=? AND project_id=? AND metric_date>=? AND metric_date<=? ORDER BY metric_date').all(tenantId, projectId, '2020-01-01', '2030-01-01')
    const sprint = sqlite.query('EXPLAIN QUERY PLAN SELECT COUNT(*),SUM(CASE WHEN status=\'DONE\' THEN 1 ELSE 0 END) FROM items WHERE tenant_id=? AND project_id=? AND status<>\'ARCHIVED\' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=items.tenant_id AND child.project_id=items.project_id AND child.parent_id=items.id)').all(tenantId, projectId)
    const projectionStateRows = sqlite.query('SELECT COUNT(*) AS count FROM project_analytics_dimension_state WHERE tenant_id=? AND project_id=?').get(tenantId, projectId) as { count: number }
    const projectionSnapshotRows = sqlite.query('SELECT COUNT(*) AS count FROM project_analytics_dimension_snapshots WHERE tenant_id=? AND project_id=?').get(tenantId, projectId) as { count: number }
    const projectionItemRows = sqlite.query('SELECT COUNT(*) AS count FROM project_analytics_dimension_items WHERE tenant_id=? AND project_id=?').get(tenantId, projectId) as { count: number }
    return { databaseVersion: version.version, leaf, snapshot, aging, history, hours, sprint, rollup, projectionCardinality: { stateRows: projectionStateRows.count, snapshotRows: projectionSnapshotRows.count, itemRows: projectionItemRows.count } }
  }
  const { createPostgresPool } = await import('../db/postgres/index')
  const runtime = await import('../persistence/runtime')
  const pool = createPostgresPool(runtime.installProfile)
  try {
    const version = await pool.query('SELECT version() AS version')
    const values = [tenantId, projectId, '2020-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z']
    const leaf = await pool.query(`EXPLAIN (FORMAT JSON) SELECT i.id FROM items i WHERE i.tenant_id=$1 AND i.project_id=$2 AND i.type IN ('TASK','BUG') AND i.status <> 'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=i.tenant_id AND child.project_id=i.project_id AND child.parent_id=i.id) ORDER BY i.id LIMIT 50`, values.slice(0, 2))
    const snapshot = await pool.query(`EXPLAIN (FORMAT JSON) SELECT i.status,i.assignee_id,COUNT(*),COUNT(i.points),SUM(i.points) FROM items i WHERE i.tenant_id=$1 AND i.project_id=$2 AND i.type IN ('TASK','BUG') AND i.status <> 'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=i.tenant_id AND child.project_id=i.project_id AND child.parent_id=i.id) GROUP BY i.status,i.assignee_id`, values.slice(0, 2))
    const aging = await pool.query(`EXPLAIN (FORMAT JSON) SELECT i.id,COALESCE((SELECT e.occurred_at FROM item_events e WHERE e.tenant_id=$1 AND e.project_id=$2 AND e.item_id=i.id AND e.event_type='STATUS_CHANGED' AND (e.after_snapshot::jsonb ->> 'status') IN ('IN_PROGRESS','BLOCKED') AND COALESCE(e.before_snapshot::jsonb ->> 'status','') NOT IN ('IN_PROGRESS','BLOCKED') ORDER BY e.occurred_at DESC,e.sequence DESC,e.id DESC LIMIT 1),(SELECT coverage_started_at FROM project_analytics_coverage WHERE tenant_id=$1 AND project_id=$2),i.created_at) AS started_at FROM items i WHERE i.tenant_id=$1 AND i.project_id=$2 AND i.type IN ('TASK','BUG') AND i.status IN ('IN_PROGRESS','BLOCKED') AND i.status<>'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=i.tenant_id AND child.project_id=i.project_id AND child.parent_id=i.id) ORDER BY started_at,i.id LIMIT 51`, values.slice(0, 2))
    const history = await pool.query('EXPLAIN (FORMAT JSON) SELECT id FROM item_events WHERE tenant_id=$1 AND project_id=$2 AND occurred_at >= $3 AND occurred_at <= $4 ORDER BY occurred_at,sequence LIMIT 100', values)
    const hours = await pool.query(`EXPLAIN (FORMAT JSON) SELECT l.id FROM item_logs l JOIN items i ON i.tenant_id=l.tenant_id AND i.id=l.item_id WHERE l.tenant_id=$1 AND i.project_id=$2 AND l.type='manual' AND l.duration_min>0 ORDER BY l.created_at,l.id LIMIT 50`, values.slice(0, 2))
    const sprint = await pool.query(`EXPLAIN (FORMAT JSON) SELECT COUNT(*),COUNT(*) FILTER (WHERE status='DONE') FROM items WHERE tenant_id=$1 AND project_id=$2 AND status<>'ARCHIVED' AND NOT EXISTS (SELECT 1 FROM items child WHERE child.tenant_id=items.tenant_id AND child.project_id=items.project_id AND child.parent_id=items.id)`, values.slice(0, 2))
    const rollup = await pool.query('EXPLAIN (FORMAT JSON) SELECT metric_date,total,done,points,done_points FROM project_metrics_daily WHERE tenant_id=$1 AND project_id=$2 AND metric_date >= $3 AND metric_date <= $4 ORDER BY metric_date', values)
    const projectionStateRows = await pool.query('SELECT COUNT(*)::int AS count FROM project_analytics_dimension_state WHERE tenant_id=$1 AND project_id=$2', values.slice(0, 2))
    const projectionSnapshotRows = await pool.query('SELECT COUNT(*)::int AS count FROM project_analytics_dimension_snapshots WHERE tenant_id=$1 AND project_id=$2', values.slice(0, 2))
    const projectionItemRows = await pool.query('SELECT COUNT(*)::int AS count FROM project_analytics_dimension_items WHERE tenant_id=$1 AND project_id=$2', values.slice(0, 2))
    return { databaseVersion: version.rows[0]?.version ?? 'unknown', leaf: leaf.rows, snapshot: snapshot.rows, aging: aging.rows, history: history.rows, hours: hours.rows, sprint: sprint.rows, rollup: rollup.rows, projectionCardinality: { stateRows: projectionStateRows.rows[0]?.count ?? 0, snapshotRows: projectionSnapshotRows.rows[0]?.count ?? 0, itemRows: projectionItemRows.rows[0]?.count ?? 0 } }
  } finally { await pool.end() }
}

async function showQueryPlans() {
  assertSeedEnvironment()
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as BenchmarkManifest
  if (manifest.profile !== profile) throw new Error('Manifest inválido ou de outro perfil.')
  const runtime = await openPersistence()
  try { console.log(JSON.stringify(await queryPlans(profile as Profile, manifest.tenantId, manifest.projectId), null, 2)) }
  finally { await runtime.closeRuntime() }
}

async function runBenchmark() {
  assertSeedEnvironment()
  const profileName = profile as Profile
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as BenchmarkManifest
  if (manifest.format !== 1 || manifest.profile !== profileName) throw new Error('Manifest inválido ou de outro perfil.')
  const runtime = await openPersistence()
  try {
    const { signJwt, SESSION_COOKIE } = await import('../services/auth')
    process.env.LOG_LEVEL = process.env.DASHBOARD_BENCHMARK_LOG_LEVEL ?? 'error'
    const { app } = await import('../index')
    const token = await signJwt({ sub: manifest.userId, tenantId: manifest.tenantId, email: manifest.email, role: 'user', globalGroup: 'ADMIN' })
    const query = (params: Record<string, string>) => new URLSearchParams(params).toString()
    const filterParams = { moduleId: manifest.moduleId, versionId: manifest.versionId, sprintId: manifest.sprintId, squadId: manifest.squadId, assigneeId: manifest.userId, type: 'TASK' }
    const allCases = [
      { name: 'snapshot/all', route: '/snapshot' },
      { name: 'snapshot/filtered', route: `/snapshot?${query(filterParams)}` },
      { name: 'aging/all', route: '/aging' },
      { name: 'aging/filtered', route: `/aging?${query(filterParams)}` },
      { name: 'hours/all', route: '/hours' },
      { name: 'hours/filtered', route: `/hours?${query(filterParams)}` },
      { name: 'sprints/cycles', route: '/sprints' },
      { name: 'sprint/cycle', route: `/sprints/${manifest.cycleId}` },
      { name: 'burnup/rollup', route: '/burnup' },
      { name: 'burnup/filtered', route: `/burnup?${query({ ...filterParams, from: dateOnly(addDays(new Date(), -365)), to: dateOnly(new Date()) })}` },
    ]
    const onlyCase = process.env.DASHBOARD_BENCHMARK_ONLY
    const cases = onlyCase ? allCases.filter(entry => entry.name === onlyCase) : allCases
    if (!cases.length) throw new Error(`DASHBOARD_BENCHMARK_ONLY inválido: ${onlyCase}`)
    const concurrency = integerEnv('DASHBOARD_BENCHMARK_CONCURRENCY', profileName === 'SIMPLE' ? 5 : 20, 1, profileName === 'SIMPLE' ? 20 : 100)
    const warmupMs = integerEnv('DASHBOARD_BENCHMARK_WARMUP_SECONDS', 30, 0, 3600) * 1000
    const rounds = integerEnv('DASHBOARD_BENCHMARK_ROUNDS', 3, 1, 10)
    const roundMs = integerEnv('DASHBOARD_BENCHMARK_ROUND_SECONDS', 120, 1, 3600) * 1000
    const origin = `http://dashboard-benchmark.local/api/projects/${manifest.projectId}/dashboard`
    const fetchRoute = async (route: string) => app.fetch(new Request(`${origin}${route}`, { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))
    const results: Array<Record<string, unknown>> = []
    const cpuCount = cpus().length
    const memoryBytes = totalmem()
    const referenceHardware = process.platform === 'linux' && cpuCount === 12
      && memoryBytes >= 15 * 1024 ** 3 && memoryBytes <= 16 * 1024 ** 3
      && process.env.DASHBOARD_BENCHMARK_REFERENCE_HARDWARE === '1'
    // SIMPLE mantém os limites v2. ADVANCED usa limites v3 aceitos para a
    // versão atual, com margem arredondada sobre o protocolo integral medido.
    const p95BudgetMs: Record<string, number> = profileName === 'SIMPLE'
      ? {
        'snapshot/all': 1000, 'snapshot/filtered': 1000,
        'aging/all': 600, 'aging/filtered': 600,
        'hours/all': 500, 'hours/filtered': 500,
        'sprints/cycles': 500, 'sprint/cycle': 500,
        'burnup/rollup': 1000, 'burnup/filtered': 1000,
      }
      : {
        'snapshot/all': 2000, 'snapshot/filtered': 900,
        'aging/all': 1300, 'aging/filtered': 350,
        'hours/all': 700, 'hours/filtered': 850,
        'sprints/cycles': 25, 'sprint/cycle': 500,
        'burnup/rollup': 1500, 'burnup/filtered': 1500,
      }
    const rssBudgetBytes = (profileName === 'SIMPLE' ? 256 : 512) * 1024 ** 2
    const runBaselineRss = process.memoryUsage().rss
    let runPeakRss = runBaselineRss

    for (const entry of cases) {
      const firstResult = results.length
      const caseBaselineRss = process.memoryUsage().rss
      let casePeakRss = caseBaselineRss
      const sampleRss = setInterval(() => {
        casePeakRss = Math.max(casePeakRss, process.memoryUsage().rss)
        runPeakRss = Math.max(runPeakRss, casePeakRss)
      }, 200)
      if (warmupMs > 0) {
        const until = Date.now() + warmupMs
        await Promise.all(Array.from({ length: concurrency }, async () => {
          while (Date.now() < until) {
            const response = await fetchRoute(entry.route)
            await response.arrayBuffer()
          }
        }))
      }
      for (let round = 1; round <= rounds; round += 1) {
        let bytes = 0
        let errors = 0
        let requests = 0
        const latencies: number[] = []
        const until = Date.now() + roundMs
        await Promise.all(Array.from({ length: concurrency }, async () => {
          while (Date.now() < until) {
            const started = performance.now()
            try {
              const response = await fetchRoute(entry.route)
              const body = await response.arrayBuffer()
              bytes += body.byteLength
              if (!response.ok) errors += 1
            } catch { errors += 1 }
            latencies.push(performance.now() - started)
            requests += 1
          }
        }))
        casePeakRss = Math.max(casePeakRss, process.memoryUsage().rss)
        runPeakRss = Math.max(runPeakRss, casePeakRss)
        const p95 = percentile(latencies, 0.95)
        const endpointP95Budget = p95BudgetMs[entry.name]
        results.push({
          endpoint: entry.name, round, concurrency, requests, errors, bytes,
          latencyMs: { p50: percentile(latencies, 0.50), p95, p99: percentile(latencies, 0.99), max: latencies.reduce((maximum, value) => Math.max(maximum, value), 0) },
          rssBytes: { baseline: runBaselineRss, peak: runPeakRss, increment: Math.max(0, runPeakRss - runBaselineRss) },
          caseRssBytes: { baseline: caseBaselineRss, peak: casePeakRss, increment: Math.max(0, casePeakRss - caseBaselineRss) },
          targets: { p95Ms: endpointP95Budget, rssIncrementBytes: rssBudgetBytes },
          withinBudget: null,
        })
      }
      clearInterval(sampleRss)
      casePeakRss = Math.max(casePeakRss, process.memoryUsage().rss)
      runPeakRss = Math.max(runPeakRss, casePeakRss)
      for (const row of results.slice(firstResult)) {
        const latency = row.latencyMs as { p95: number }
        const withinBudget = row.errors === 0 && latency.p95 <= (row.targets as { p95Ms: number }).p95Ms
          && Math.max(0, runPeakRss - runBaselineRss) <= rssBudgetBytes
        row.rssBytes = { baseline: runBaselineRss, peak: runPeakRss, increment: Math.max(0, runPeakRss - runBaselineRss) }
        row.caseRssBytes = { baseline: caseBaselineRss, peak: casePeakRss, increment: Math.max(0, casePeakRss - caseBaselineRss) }
        row.withinBudget = referenceHardware ? withinBudget : null
        console.log(JSON.stringify(row))
      }
    }

    for (const row of results) {
      const latency = row.latencyMs as { p95: number }
      const withinBudget = row.errors === 0 && latency.p95 <= (row.targets as { p95Ms: number }).p95Ms
        && Math.max(0, runPeakRss - runBaselineRss) <= rssBudgetBytes
      row.rssBytes = { baseline: runBaselineRss, peak: runPeakRss, increment: Math.max(0, runPeakRss - runBaselineRss) }
      row.withinBudget = referenceHardware ? withinBudget : null
    }

    const fullProtocol = !onlyCase && warmupMs === 30_000 && rounds === 3 && roundMs === 120_000
      && concurrency === (profileName === 'SIMPLE' ? 5 : 20)
    const budgetsMet = referenceHardware ? results.every(row => row.withinBudget === true) : null
    const noErrors = results.every(row => row.errors === 0)
    const conformance = !referenceHardware ? 'INFORMATIVE' : !fullProtocol ? 'SMOKE_ONLY' : budgetsMet ? 'PASS' : 'FAIL'
    const plans = await queryPlans(profileName, manifest.tenantId, manifest.projectId)
    const report = {
      format: 1,
      runAt: new Date().toISOString(),
      profile: profileName,
      seed: manifest.seed,
      projectId: manifest.projectId,
      counts: { leaves: manifest.leaves, aggregators: manifest.aggregators, events: manifest.events },
      hardware: { platform: process.platform, arch: process.arch, cpuModel: cpus()[0]?.model ?? 'unknown', vcpus: cpuCount, memoryBytes, reference: referenceHardware, referenceDeclared: process.env.DASHBOARD_BENCHMARK_REFERENCE_HARDWARE === '1', referenceNote: referenceHardware ? 'Linux/12 vCPU/~16 GiB RAM e referência SSD/serviços no mesmo host declarada.' : 'Hardware/referência não confirmados (requer Linux 12 vCPU/~16 GiB/NVMe e DASHBOARD_BENCHMARK_REFERENCE_HARDWARE=1); resultado informativo.' },
      versions: { bun: process.versions.bun ?? null, node: process.versions.node, database: (plans as { databaseVersion?: string }).databaseVersion ?? null },
      sha: Bun.spawnSync(['git', 'rev-parse', 'HEAD']).stdout.toString().trim(),
      protocol: { warmupSeconds: warmupMs / 1000, rounds, roundSeconds: roundMs / 1000, concurrency },
      conformance,
      budgetsMet,
      results,
      queryPlans: plans,
      passed: noErrors && (!referenceHardware || budgetsMet === true),
    }
    const outputPath = resolve(process.env.DASHBOARD_BENCHMARK_REPORT ?? manifestPath.replace(/manifest\.json$/, `report-${Date.now()}.json`))
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
    console.log(JSON.stringify({ report: outputPath, passed: report.passed, referenceHardware, conformance }, null, 2))
    if (!report.passed) process.exitCode = 1
  } finally {
    await runtime.closeRuntime()
  }
}

const mode = process.argv[2] ?? 'seed'
if (import.meta.main) {
  if (mode === 'seed') await seed()
  else if (mode === 'run') await runBenchmark()
  else if (mode === 'plans') await showQueryPlans()
  else throw new Error('Uso: dashboard-benchmark.ts <seed|run>.')
}
