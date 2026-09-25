import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Database } from 'bun:sqlite'
import type { InstallProfile, InstallProfileConfig } from './installProfile'
import { auditIntegrity } from './integrity'

export const INSTALLATION_SCHEMA_REVISION = 1
export const INSTALLATION_MARKER_FILENAME = '.azyboard-installation.json'

export interface InstallationMarker {
  formatVersion: 1
  instanceId: string
  profile: InstallProfile
  databaseFingerprint: string
  schemaRevision: number
}

export type UnmarkedDatabaseState = 'EMPTY' | 'LEGACY_SIMPLE' | 'UNCLASSIFIED_DATA'

export interface InstallationMarkerStore {
  read(): Promise<InstallationMarker | null>
  write(marker: InstallationMarker): Promise<void>
  inspectUnmarked(): Promise<UnmarkedDatabaseState>
  auditLegacySimple(): Promise<void>
}

const APP_TABLES = [
  'tenants', 'users', 'user_avatars', 'login_attempts', 'api_keys',
  'assistant_credentials', 'assistant_settings', 'assistant_conversations', 'assistant_messages', 'assistant_runs',
  'assistant_events', 'assistant_tool_calls', 'assistant_approvals', 'idempotency_records', 'projects', 'squads',
  'project_cost_centers', 'memberships', 'modules', 'columns', 'sprints', 'items', 'project_versions', 'item_logs',
  'tags', 'item_tags', 'item_sprints', 'project_analytics_coverage', 'item_events', 'sprint_cycles',
  'sprint_cycle_items', 'attachments', 'checklists', 'checklist_items', 'storage_cleanup_jobs', 'project_metrics_daily',
] as const

/** Fingerprint irreversível; não inclui credenciais nem parâmetros de conexão. */
export function databaseFingerprint(profile: InstallProfile, databaseUrl: string): string {
  let target: string
  if (profile === 'ADVANCED') {
    const url = new URL(databaseUrl)
    target = `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || defaultPort(url.protocol)}${url.pathname}`
  } else {
    const localPath = databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl
    target = localPath === ':memory:' ? 'sqlite::memory:' : `sqlite:${resolve(localPath)}`
  }
  return createHash('sha256').update(target).digest('hex')
}

function defaultPort(protocol: string): string {
  return protocol === 'postgres:' || protocol === 'postgresql:' ? '5432' : ''
}

function isMarker(value: unknown): value is InstallationMarker {
  if (!value || typeof value !== 'object') return false
  const marker = value as Partial<InstallationMarker>
  return marker.formatVersion === 1
    && typeof marker.instanceId === 'string'
    && (marker.profile === 'SIMPLE' || marker.profile === 'ADVANCED')
    && typeof marker.databaseFingerprint === 'string'
    && typeof marker.schemaRevision === 'number'
}

function sameMarker(a: InstallationMarker, b: InstallationMarker): boolean {
  return a.formatVersion === b.formatVersion
    && a.instanceId === b.instanceId
    && a.profile === b.profile
    && a.databaseFingerprint === b.databaseFingerprint
    && a.schemaRevision === b.schemaRevision
}

function assertMarkerMatchesConfig(marker: InstallationMarker, config: InstallProfileConfig) {
  if (marker.profile !== config.profile) {
    throw new Error('INSTALL_PROFILE_MISMATCH: o perfil desta instalação é imutável; use uma nova instância para escolher outro perfil.')
  }
  if (marker.databaseFingerprint !== databaseFingerprint(config.profile, config.databaseUrl)) {
    throw new Error('INSTALL_DATABASE_MISMATCH: o banco configurado não pertence a esta instalação; não há troca nem migração automática de dados.')
  }
  if (marker.schemaRevision > INSTALLATION_SCHEMA_REVISION) {
    throw new Error('INSTALLATION_MARKER_TOO_NEW: os marcadores foram gravados por uma versão mais nova da aplicação.')
  }
}

async function readVolumeMarker(config: InstallProfileConfig): Promise<InstallationMarker | null> {
  const path = join(config.instanceDir, INSTALLATION_MARKER_FILENAME)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('INSTALLATION_MARKER_INVALID: marcador do volume inválido; recupere-o a partir do backup da instalação.')
  }
  if (!isMarker(value)) throw new Error('INSTALLATION_MARKER_INVALID: formato de marcador do volume não reconhecido.')
  return value
}

function readVolumeMarkerSync(config: InstallProfileConfig): InstallationMarker | null {
  const path = join(config.instanceDir, INSTALLATION_MARKER_FILENAME)
  if (!existsSync(path)) return null
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error('INSTALLATION_MARKER_INVALID: marcador do volume inválido; recupere-o a partir do backup da instalação.')
  }
  if (!isMarker(value)) throw new Error('INSTALLATION_MARKER_INVALID: formato de marcador do volume não reconhecido.')
  return value
}

/** Check persistent identity before migrations/PRAGMAs can modify the target database. */
export function preflightVolumeMarker(config: InstallProfileConfig): void {
  const marker = readVolumeMarkerSync(config)
  if (marker) assertMarkerMatchesConfig(marker, config)
}

/** Check existing DB marker synchronously before migration or any application write. */
export function preflightInstallationMarkers(config: InstallProfileConfig, sqlite: Database): void {
  const volumeMarker = readVolumeMarkerSync(config)
  if (volumeMarker) assertMarkerMatchesConfig(volumeMarker, config)

  const metadataTable = sqlite.query(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'installation_metadata'`).get()
  if (!metadataTable) return // Fresh/legacy DB; full classification follows after migrations.
  const row = sqlite.query(`
    SELECT instance_id AS instanceId, profile, database_fingerprint AS databaseFingerprint, schema_revision AS schemaRevision
    FROM installation_metadata WHERE id = 1
  `).get() as Omit<InstallationMarker, 'formatVersion'> | null
  const databaseMarker = row ? { formatVersion: 1 as const, ...row } : null

  if (databaseMarker && !isMarker(databaseMarker)) throw new Error('INSTALLATION_DATABASE_MARKER_INVALID: marcador do banco inválido.')
  if (databaseMarker && !volumeMarker) {
    throw new Error('INSTALLATION_VOLUME_MARKER_MISSING: restaure o marcador do volume a partir do backup; não inicialize como instalação nova.')
  }
  if (databaseMarker && volumeMarker && !sameMarker(databaseMarker, volumeMarker)) {
    throw new Error('INSTALLATION_MARKER_MISMATCH: o marcador do volume não corresponde ao do banco.')
  }
}

async function writeVolumeMarker(config: InstallProfileConfig, marker: InstallationMarker) {
  await mkdir(config.instanceDir, { recursive: true })
  const path = join(config.instanceDir, INSTALLATION_MARKER_FILENAME)
  try {
    await writeFile(path, `${JSON.stringify(marker, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      const existing = await readVolumeMarker(config)
      if (existing && sameMarker(existing, marker)) return
      throw new Error('INSTALLATION_MARKER_RACE: outro processo inicializou esta instalação com marcadores diferentes.')
    }
    throw error
  }
}

function newMarker(config: InstallProfileConfig): InstallationMarker {
  return {
    formatVersion: 1,
    instanceId: randomUUID(),
    profile: config.profile,
    databaseFingerprint: databaseFingerprint(config.profile, config.databaseUrl),
    schemaRevision: INSTALLATION_SCHEMA_REVISION,
  }
}

/** Vincula volume persistente, banco e perfil usando apenas identidade opaca e fingerprint sem credenciais. */
export async function ensureInstallationMarkers(config: InstallProfileConfig, store: InstallationMarkerStore): Promise<InstallationMarker> {
  const volumeMarker = await readVolumeMarker(config)
  const databaseMarker = await store.read()

  if (volumeMarker && databaseMarker) {
    assertMarkerMatchesConfig(volumeMarker, config)
    if (!sameMarker(volumeMarker, databaseMarker)) {
      throw new Error('INSTALLATION_MARKER_MISMATCH: o marcador do volume não corresponde ao do banco.')
    }
    return volumeMarker
  }

  if (databaseMarker && !volumeMarker) {
    throw new Error('INSTALLATION_VOLUME_MARKER_MISSING: restaure o marcador do volume a partir do backup; não inicialize como instalação nova.')
  }

  if (volumeMarker) {
    assertMarkerMatchesConfig(volumeMarker, config)
    const state = await store.inspectUnmarked()
    if (state === 'UNCLASSIFIED_DATA') {
      throw new Error('INSTALLATION_DATABASE_MARKER_MISSING: o banco contém dados sem marcador reconhecível; interrompa e faça recuperação manual.')
    }
    if (state === 'LEGACY_SIMPLE') {
      if (config.profile !== 'SIMPLE') {
        throw new Error('LEGACY_SQLITE_REQUIRES_NEW_INSTALLATION: dados legados SQLite não são importados para ADVANCED.')
      }
      await store.auditLegacySimple()
    }
    await store.write(volumeMarker)
    return volumeMarker
  }

  const state = await store.inspectUnmarked()
  if (state === 'UNCLASSIFIED_DATA') {
    throw new Error('INSTALLATION_MARKER_MISSING: o banco contém dados não classificados; não será tratado como instalação nova.')
  }
  if (state === 'LEGACY_SIMPLE') {
    if (config.profile !== 'SIMPLE') {
      throw new Error('LEGACY_SQLITE_REQUIRES_NEW_INSTALLATION: dados legados SQLite não são importados para ADVANCED.')
    }
    await store.auditLegacySimple()
  }

  const marker = newMarker(config)
  // Arquivo em volume primeiro: se a gravação no DB falhar, a próxima execução
  // só pode completar a inicialização para o mesmo perfil e o mesmo fingerprint.
  await writeVolumeMarker(config, marker)
  await store.write(marker)
  return marker
}

/** Adapter SQLite para SIMPLE e reconhecimento auditado de bases SQLite legadas. */
export function sqliteInstallationMarkerStore(sqlite: Database): InstallationMarkerStore {
  return {
    async read() {
      try {
        const row = sqlite.query(`SELECT instance_id AS instanceId, profile, database_fingerprint AS databaseFingerprint, schema_revision AS schemaRevision FROM installation_metadata WHERE id = 1`).get() as Omit<InstallationMarker, 'formatVersion'> | null
        return row ? { formatVersion: 1, ...row } : null
      } catch {
        throw new Error('INSTALLATION_METADATA_MISSING: execute as migrations do perfil SIMPLE antes do setup/runtime.')
      }
    },
    async write(marker) {
      sqlite.query(`INSERT INTO installation_metadata (id, instance_id, profile, database_fingerprint, schema_revision) VALUES (1, ?, ?, ?, ?)`)
        .run(marker.instanceId, marker.profile, marker.databaseFingerprint, marker.schemaRevision)
    },
    async inspectUnmarked() {
      let tables: Array<{ name: string }>
      try {
        tables = sqlite.query(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{ name: string }>
      } catch {
        throw new Error('INSTALLATION_METADATA_MISSING: execute as migrations antes de inspecionar o perfil.')
      }
      const available = new Set(tables.map(table => table.name))
      const populated: string[] = []
      for (const table of APP_TABLES) {
        if (!available.has(table)) continue
        if (sqlite.query(`SELECT 1 FROM "${table}" LIMIT 1`).get()) populated.push(table)
      }
      if (populated.length === 0) return 'EMPTY'
      const hasTenant = populated.includes('tenants')
      return hasTenant ? 'LEGACY_SIMPLE' : 'UNCLASSIFIED_DATA'
    },
    async auditLegacySimple() {
      const foreignKeyViolations = sqlite.query('PRAGMA foreign_key_check').all()
      const domainViolations = auditIntegrity(sqlite)
      if (foreignKeyViolations.length || domainViolations.length) {
        const checks = domainViolations.map(violation => `${violation.check}:${violation.count}`).join(', ')
        throw new Error(`LEGACY_SQLITE_AUDIT_FAILED: foreign keys=${foreignKeyViolations.length}; checks=${checks || 'none'}`)
      }
    },
  }
}
