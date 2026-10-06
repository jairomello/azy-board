import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { shouldRunPostgresTests } from './pgTestSupport'

// [T37] Migrations aditivas sobre dados legados: runs criadas ANTES das colunas
// de fencing (lease_generation/recovery_attempts) permanecem válidas e recebem
// os defaults, sem perda de dados.
const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_advanced_legacy'
const runPostgres = await shouldRunPostgresTests(PG_URL)
const migrationsDir = join(import.meta.dir, 'migrations')
const T37_START = '0012_agent_lease_generation.sql'

describe.skipIf(!runPostgres)('Migrations PostgreSQL — dados legados T37', () => {
  test('colunas de fencing preservam runs existentes com defaults', async () => {
    const setup = new Client({ connectionString: PG_URL })
    await setup.connect()
    await setup.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    await setup.end()

    const files = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
    const pre = files.filter(name => name < T37_START)
    const post = files.filter(name => name >= T37_START)

    const client = new Client({ connectionString: PG_URL })
    await client.connect()
    for (const file of pre) await client.query(readFileSync(join(migrationsDir, file), 'utf8'))

    // Dados "legados": entidades mínimas + uma run sem as novas colunas.
    const now = new Date().toISOString()
    await client.query('INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)', ['t-legacy', 'Legacy', 'legacy'])
    await client.query('INSERT INTO users (id, tenant_id, email, password_hash, name) VALUES ($1, $2, $3, $4, $5)', ['u-legacy', 't-legacy', 'legacy@test.local', 'hash', 'Legacy'])
    await client.query('INSERT INTO assistant_conversations (id, tenant_id, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', ['c-legacy', 't-legacy', 'u-legacy', now, now])
    await client.query('INSERT INTO assistant_runs (id, tenant_id, conversation_id, user_id, status, current_cursor, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', ['r-legacy', 't-legacy', 'c-legacy', 'u-legacy', 'QUEUED', 0, now])

    for (const file of post) await client.query(readFileSync(join(migrationsDir, file), 'utf8'))

    const row = await client.query('SELECT id, status, lease_generation, recovery_attempts FROM assistant_runs WHERE id = $1', ['r-legacy'])
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0]).toMatchObject({ id: 'r-legacy', status: 'QUEUED', lease_generation: 0, recovery_attempts: 0 })
    await client.end()
  })
})
