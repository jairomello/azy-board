import { Pool, type PoolClient } from 'pg'
import type { InstallProfileConfig } from '../installProfile'
import {
  type InstallationMarker,
  type InstallationMarkerStore,
  type UnmarkedDatabaseState,
  preflightVolumeMarker,
} from '../installationMarkers'

export class PostgresConnectionError extends Error {
  readonly code = 'POSTGRES_CONNECTION_FAILED'
  constructor(message: string) {
    super(message)
    this.name = 'PostgresConnectionError'
  }
}

/**
 * Cria pool PostgreSQL somente após validar perfil ADVANCED e marcador do volume.
 * O marcador do banco é validado após a conexão (precisa de query).
 */
export function createPostgresPool(config: InstallProfileConfig): Pool {
  if (config.profile !== 'ADVANCED') {
    throw new PostgresConnectionError('Pool PostgreSQL só é permitido no perfil ADVANCED.')
  }
  // Valida marcador do volume ANTES de abrir conexão.
  preflightVolumeMarker(config)
  return new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // SSL pode ser habilitado via ?sslmode=verify-full na URL.
  })
}

/**
 * Preflight completo: valida perfil ADVANCED, marcador do volume e marcador do banco.
 * Retorna o pool pronto para uso. Chame antes de aceitar tráfego.
 */
export async function preflightPostgres(config: InstallProfileConfig): Promise<Pool> {
  const pool = createPostgresPool(config)
  try {
    // Valida marcador do banco (precisa de conexão).
    const store = pgInstallationMarkerStore(pool)
    const databaseMarker = await store.read()
    const volumeMarker = await readVolumeMarkerForPool(config)
    if (volumeMarker && databaseMarker) {
      if (volumeMarker.instanceId !== databaseMarker.instanceId
        || volumeMarker.profile !== databaseMarker.profile
        || volumeMarker.databaseFingerprint !== databaseMarker.databaseFingerprint) {
        throw new Error('INSTALLATION_MARKER_MISMATCH: o marcador do volume não corresponde ao do banco.')
      }
    }
    return pool
  } catch (error) {
    await pool.end()
    throw error
  }
}

async function readVolumeMarkerForPool(config: InstallProfileConfig): Promise<InstallationMarker | null> {
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { INSTALLATION_MARKER_FILENAME } = await import('../installationMarkers')
  const path = join(config.instanceDir, INSTALLATION_MARKER_FILENAME)
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as InstallationMarker
  } catch {
    return null
  }
}

/**
 * Executa uma transação PostgreSQL com rollback automático em erro.
 * Diferente do bun:sqlite, o driver pg é assíncrono e suporta await dentro
 * da transação sem risco de commit prematuro.
 */
export async function runPgTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Adapter de marcadores de instalação para PostgreSQL (ADVANCED). */
export function pgInstallationMarkerStore(pool: Pool): InstallationMarkerStore {
  return {
    async read(): Promise<InstallationMarker | null> {
      try {
        const result = await pool.query(
          `SELECT instance_id AS "instanceId", profile, database_fingerprint AS "databaseFingerprint", schema_revision AS "schemaRevision"
           FROM installation_metadata WHERE id = 1`
        )
        const row = result.rows[0]
        return row ? { formatVersion: 1, ...row } : null
      } catch {
        throw new Error('INSTALLATION_METADATA_MISSING: execute as migrations do perfil ADVANCED antes do setup/runtime.')
      }
    },
    async write(marker: InstallationMarker): Promise<void> {
      await pool.query(
        `INSERT INTO installation_metadata (id, instance_id, profile, database_fingerprint, schema_revision)
         VALUES (1, $1, $2, $3, $4)`,
        [marker.instanceId, marker.profile, marker.databaseFingerprint, marker.schemaRevision]
      )
    },
    async inspectUnmarked(): Promise<UnmarkedDatabaseState> {
      const result = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
      )
      const available = new Set(result.rows.map((r: { tablename: string }) => r.tablename))
      const APP_TABLES = [
        'tenants', 'users', 'user_avatars', 'login_attempts', 'api_keys',
        'assistant_credentials', 'assistant_settings', 'assistant_conversations', 'assistant_messages', 'assistant_runs',
        'assistant_events', 'assistant_tool_calls', 'assistant_approvals', 'idempotency_records', 'projects', 'squads',
        'project_cost_centers', 'memberships', 'modules', 'columns', 'sprints', 'items', 'project_versions', 'item_logs',
        'tags', 'item_tags', 'item_sprints', 'project_analytics_coverage', 'item_events', 'sprint_cycles',
        'sprint_cycle_items', 'attachments', 'checklists', 'checklist_items', 'storage_cleanup_jobs', 'project_metrics_daily',
      ]
      const populated: string[] = []
      for (const table of APP_TABLES) {
        if (!available.has(table)) continue
        const check = await pool.query(`SELECT 1 FROM "${table}" LIMIT 1`)
        if (check.rows.length > 0) populated.push(table)
      }
      if (populated.length === 0) return 'EMPTY'
      const hasTenant = populated.includes('tenants')
      return hasTenant ? 'LEGACY_SIMPLE' : 'UNCLASSIFIED_DATA'
    },
    async auditLegacySimple(): Promise<void> {
      throw new Error('LEGACY_SQLITE_REQUIRES_NEW_INSTALLATION: dados legados SQLite não são importados para ADVANCED.')
    },
  }
}

/** Executa migrações SQL brutas no pool (para setup/migrations). */
export async function runPgMigrations(pool: Pool, statements: string[]): Promise<void> {
  await runPgTransaction(pool, async (client) => {
    for (const sql of statements) {
      await client.query(sql)
    }
  })
}
