import { describe, expect, test } from 'bun:test'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_test'

async function getClient(): Promise<Client> {
  const client = new Client({ connectionString: PG_URL })
  await client.connect()
  return client
}

async function resetDatabase(client: Client) {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
}

async function runMigrations(client: Client) {
  const migrationsDir = join(import.meta.dir, 'migrations')
  const files = ['0000_pale_warlock.sql', '0001_composite_fks.sql']
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    await client.query(sql)
  }
}

describe('Migrations PostgreSQL', () => {
  test('executa em banco vazio sem erro', async () => {
    const client = await getClient()
    try {
      await resetDatabase(client)
      await runMigrations(client)
      const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
      const names = tables.rows.map(r => (r as Record<string, unknown>).tablename)
      expect(names).toContain('tenants')
      expect(names).toContain('users')
      expect(names).toContain('projects')
      expect(names).toContain('items')
      expect(names).toContain('assistant_runs')
    } finally {
      await client.end()
    }
  })

  test('é idempotente: reexecutar não causa erro nem altera dados', async () => {
    const client = await getClient()
    try {
      await resetDatabase(client)
      await runMigrations(client)
      // Inserir dados de teste
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ('t1', 'Test', 'test')")
      // Reexecutar primeira migration (CREATE TABLE IF NOT EXISTS)
      const sql0 = readFileSync(join(import.meta.dir, 'migrations', '0000_pale_warlock.sql'), 'utf8')
      await client.query(sql0)
      // Dados preservados
      const result = await client.query("SELECT name FROM tenants WHERE id = 't1'")
      expect(result.rows[0]).toBeDefined()
    } finally {
      await client.end()
    }
  })

  test('chaves tenant-composite rejeitam vínculo cross-tenant', async () => {
    const client = await getClient()
    try {
      await resetDatabase(client)
      await runMigrations(client)
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ('t1', 'Tenant 1', 't1')")
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ('t2', 'Tenant 2', 't2')")
      await client.query("INSERT INTO users (id, tenant_id, email, password_hash, name) VALUES ('u1', 't1', 'u1@test.com', 'hash', 'User 1')")
      // Tentar criar item em t2 com parent em t1 — deve falhar
      await client.query("INSERT INTO projects (id, tenant_id, name) VALUES ('p2', 't2', 'Project 2')")
      await expect(
        client.query("INSERT INTO items (id, tenant_id, project_id, type, title, parent_id) VALUES ('i1', 't2', 'p2', 'TASK', 'Item', 'u1')")
      ).rejects.toThrow()
    } finally {
      await client.end()
    }
  })

  test('e-mail global é único (case-insensitive)', async () => {
    const client = await getClient()
    try {
      await resetDatabase(client)
      await runMigrations(client)
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ('t1', 'T1', 't1')")
      await client.query("INSERT INTO users (id, tenant_id, email, password_hash, name) VALUES ('u1', 't1', 'user@test.com', 'hash', 'U1')")
      // Mesmo e-mail com case diferente deve falhar
      await expect(
        client.query("INSERT INTO users (id, tenant_id, email, password_hash, name) VALUES ('u2', 't1', 'USER@test.com', 'hash', 'U2')")
      ).rejects.toThrow()
    } finally {
      await client.end()
    }
  })

  test('CHECK constraints são aplicados', async () => {
    const client = await getClient()
    try {
      await resetDatabase(client)
      await runMigrations(client)
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ('t1', 'T1', 't1')")
      // boardMode inválido deve falhar
      await expect(
        client.query("INSERT INTO projects (id, tenant_id, name, board_mode) VALUES ('p1', 't1', 'P1', 'INVALID')")
      ).rejects.toThrow()
      // priority inválida deve falhar
      await client.query("INSERT INTO projects (id, tenant_id, name) VALUES ('p1', 't1', 'P1')")
      await expect(
        client.query("INSERT INTO items (id, tenant_id, project_id, type, title, priority) VALUES ('i1', 't1', 'p1', 'TASK', 'T', 'INVALID')")
      ).rejects.toThrow()
    } finally {
      await client.end()
    }
  })

  test('timestamps são gerados automaticamente', async () => {
    const client = await getClient()
    try {
      await resetDatabase(client)
      await runMigrations(client)
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ('t1', 'T1', 't1')")
      const result = await client.query("SELECT created_at FROM tenants WHERE id = 't1'")
      expect((result.rows[0] as Record<string, unknown>).created_at).toBeTruthy()
    } finally {
      await client.end()
    }
  })
})
