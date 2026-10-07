/** Backfill retomável das projeções históricas por projeto, sem remover eventos. */
export {}
const runtime = await import('../persistence/runtime')

await runtime.bootstrapRuntime()
try {
  const projectId = Bun.argv[2]
  const startedAt = performance.now()
  await runtime.persistence.analytics.backfillDimensionProjections(projectId)
  let cardinality: { stateRows: number; snapshotRows: number; itemRows: number; readyProjects: number }
  if (runtime.installProfile.profile === 'SIMPLE') {
    const { sqlite } = await import('../db/index')
    const scope = projectId ? ' WHERE project_id = ?' : ''
    const args = projectId ? [projectId] : []
    const count = (table: string) => Number((sqlite.query(`SELECT COUNT(*) AS count FROM ${table}${scope}`).get(...args) as { count: number }).count)
    cardinality = {
      stateRows: count('project_analytics_dimension_state'),
      snapshotRows: count('project_analytics_dimension_snapshots'),
      itemRows: count('project_analytics_dimension_items'),
      readyProjects: Number((sqlite.query(`SELECT COUNT(*) AS count FROM project_analytics_dimension_meta WHERE status = 'READY'${projectId ? ' AND project_id = ?' : ''}`).get(...args) as { count: number }).count),
    }
  } else {
    const { createPostgresPool } = await import('../db/postgres/index')
    const pool = createPostgresPool(runtime.installProfile)
    try {
      const scope = projectId ? ' WHERE project_id = $1' : ''
      const count = async (table: string) => Number((await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}${scope}`, projectId ? [projectId] : [])).rows[0]?.count ?? 0)
      cardinality = {
        stateRows: await count('project_analytics_dimension_state'),
        snapshotRows: await count('project_analytics_dimension_snapshots'),
        itemRows: await count('project_analytics_dimension_items'),
        readyProjects: Number((await pool.query(`SELECT COUNT(*)::int AS count FROM project_analytics_dimension_meta WHERE status = 'READY'${projectId ? ' AND project_id = $1' : ''}`, projectId ? [projectId] : [])).rows[0]?.count ?? 0),
      }
    } finally { await pool.end() }
  }
  console.log(JSON.stringify({
    status: 'READY', projectId: projectId ?? null, durationMs: Math.round(performance.now() - startedAt),
    cardinality,
  }, null, 2))
} finally {
  await runtime.closeRuntime()
}
