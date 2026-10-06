import type { Database } from 'bun:sqlite'
import { auditIntegrity } from '../integrity'
import {
  APP_TABLES,
  type InstallationMarker,
  type InstallationMarkerStore,
  assertInstallationMarkerMatchesConfig,
  isInstallationMarker,
  readVolumeMarkerSync,
  sameInstallationMarker,
} from '../installationMarkers'
import type { InstallProfileConfig } from '../installProfile'

// [DB-SWAP] Helpers exclusivos do dialect SQLite (SIMPLE): preflight síncrono e
// store de marcadores com auditoria de integridade. Mantidos fora do contrato
// genérico para que o caminho ADVANCED nunca importe driver/auditoria SQLite.

/** Check existing DB marker synchronously before migration or any application write. */
export function preflightInstallationMarkers(config: InstallProfileConfig, sqlite: Database): void {
  const volumeMarker = readVolumeMarkerSync(config)
  if (volumeMarker) assertInstallationMarkerMatchesConfig(volumeMarker, config)

  const metadataTable = sqlite.query(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'installation_metadata'`).get()
  if (!metadataTable) return // Fresh/legacy DB; full classification follows after migrations.
  const row = sqlite.query(`
    SELECT instance_id AS instanceId, profile, database_fingerprint AS databaseFingerprint, schema_revision AS schemaRevision
    FROM installation_metadata WHERE id = 1
  `).get() as Omit<InstallationMarker, 'formatVersion'> | null
  const databaseMarker = row ? { formatVersion: 1 as const, ...row } : null

  if (databaseMarker && !isInstallationMarker(databaseMarker)) throw new Error('INSTALLATION_DATABASE_MARKER_INVALID: marcador do banco inválido.')
  if (databaseMarker && !volumeMarker) {
    throw new Error('INSTALLATION_VOLUME_MARKER_MISSING: restaure o marcador do volume a partir do backup; não inicialize como instalação nova.')
  }
  if (databaseMarker && volumeMarker && !sameInstallationMarker(databaseMarker, volumeMarker)) {
    throw new Error('INSTALLATION_MARKER_MISMATCH: o marcador do volume não corresponde ao do banco.')
  }
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
