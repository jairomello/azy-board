import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { InstallProfile, InstallProfileConfig } from './installProfile'

// [DB-SWAP] Contrato genérico de marcadores de instalação, independente de
// driver: tipos, fingerprint, leitura/gravação do marcador de volume e o fluxo
// `ensureInstallationMarkers`. Helpers SQLite (store + auditoria) vivem em
// `db/sqlite/installationMarkers.ts`; o store PostgreSQL em `db/postgres/index.ts`.
// Nenhum módulo comum abre banco como efeito de import.

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

/** Tabelas de aplicação usadas para classificar uma base sem marcador. */
export const APP_TABLES = [
  'tenants', 'users', 'user_avatars', 'login_attempts', 'api_keys',
  'assistant_credentials', 'assistant_settings', 'assistant_conversations', 'assistant_messages', 'assistant_runs',
  'assistant_events', 'assistant_tool_calls', 'assistant_approvals', 'idempotency_records', 'projects', 'squads',
  'project_cost_centers', 'memberships', 'modules', 'columns', 'sprints', 'items', 'project_versions', 'item_logs',
  'tags', 'item_tags', 'item_sprints', 'project_analytics_coverage', 'item_events', 'sprint_cycles',
  'sprint_cycle_items', 'attachments', 'item_links', 'checklists', 'checklist_items', 'storage_cleanup_jobs', 'project_metrics_daily',
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

export function isInstallationMarker(value: unknown): value is InstallationMarker {
  if (!value || typeof value !== 'object') return false
  const marker = value as Partial<InstallationMarker>
  return marker.formatVersion === 1
    && typeof marker.instanceId === 'string'
    && (marker.profile === 'SIMPLE' || marker.profile === 'ADVANCED')
    && typeof marker.databaseFingerprint === 'string'
    && typeof marker.schemaRevision === 'number'
}

export function sameInstallationMarker(a: InstallationMarker, b: InstallationMarker): boolean {
  return a.formatVersion === b.formatVersion
    && a.instanceId === b.instanceId
    && a.profile === b.profile
    && a.databaseFingerprint === b.databaseFingerprint
    && a.schemaRevision === b.schemaRevision
}

export function assertInstallationMarkerMatchesConfig(marker: InstallationMarker, config: InstallProfileConfig): void {
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
  if (!isInstallationMarker(value)) throw new Error('INSTALLATION_MARKER_INVALID: formato de marcador do volume não reconhecido.')
  return value
}

export function readVolumeMarkerSync(config: InstallProfileConfig): InstallationMarker | null {
  const path = join(config.instanceDir, INSTALLATION_MARKER_FILENAME)
  if (!existsSync(path)) return null
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error('INSTALLATION_MARKER_INVALID: marcador do volume inválido; recupere-o a partir do backup da instalação.')
  }
  if (!isInstallationMarker(value)) throw new Error('INSTALLATION_MARKER_INVALID: formato de marcador do volume não reconhecido.')
  return value
}

/** Check persistent identity before migrations/PRAGMAs can modify the target database. */
export function preflightVolumeMarker(config: InstallProfileConfig): void {
  const marker = readVolumeMarkerSync(config)
  if (marker) assertInstallationMarkerMatchesConfig(marker, config)
}

async function writeVolumeMarker(config: InstallProfileConfig, marker: InstallationMarker) {
  await mkdir(config.instanceDir, { recursive: true })
  const path = join(config.instanceDir, INSTALLATION_MARKER_FILENAME)
  try {
    await writeFile(path, `${JSON.stringify(marker, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      const existing = await readVolumeMarker(config)
      if (existing && sameInstallationMarker(existing, marker)) return
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
    assertInstallationMarkerMatchesConfig(volumeMarker, config)
    if (!sameInstallationMarker(volumeMarker, databaseMarker)) {
      throw new Error('INSTALLATION_MARKER_MISMATCH: o marcador do volume não corresponde ao do banco.')
    }
    return volumeMarker
  }

  if (databaseMarker && !volumeMarker) {
    throw new Error('INSTALLATION_VOLUME_MARKER_MISSING: restaure o marcador do volume a partir do backup; não inicialize como instalação nova.')
  }

  if (volumeMarker) {
    assertInstallationMarkerMatchesConfig(volumeMarker, config)
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
