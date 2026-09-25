import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database as BunDatabase } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'
import { resolveInstallProfile } from './installProfile'
import { ensureInstallationMarkers, preflightInstallationMarkers, preflightVolumeMarker, sqliteInstallationMarkerStore } from './installationMarkers'

const install = resolveInstallProfile()
if (install.profile !== 'SIMPLE') {
  throw new Error('ADVANCED_DATABASE_ADAPTER_NOT_READY: refusing to run SQLite migrations for an ADVANCED installation.')
}
preflightVolumeMarker(install)

// [DB-SWAP] Este runner é exclusivo do perfil SIMPLE. ADVANCED terá runner e
// journal PostgreSQL próprios; nunca reutilizar migrations SQLite nesse perfil.
const sqlite = new BunDatabase(install.databaseUrl)

try {
  preflightInstallationMarkers(install, sqlite)
  // SQLite não permite PRAGMA foreign_keys dentro de uma transaction — desativar ANTES do migrate.
  sqlite.exec('PRAGMA foreign_keys = OFF;')

  const db = drizzle(sqlite, { schema })

  console.log('Executando migrações...')
  // Em produção o caminho das migrations é configurado via MIGRATIONS_DIR.
  migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR || './src/db/migrations' })
  console.log('Migrações concluídas.')

  // Verificação pós-migration: nenhuma violação de chave estrangeira residual.
  const foreignKeyViolations = sqlite.query('PRAGMA foreign_key_check').all()
  if (foreignKeyViolations.length > 0) {
    throw new Error(`Integridade referencial violada após migração: ${JSON.stringify(foreignKeyViolations.slice(0, 10))}`)
  }

  sqlite.exec('PRAGMA foreign_keys = ON;')
  // Liga o banco ao marcador durável do volume. Dados legados só são adotados
  // como SIMPLE depois da auditoria de FK e invariantes de domínio.
  await ensureInstallationMarkers(install, sqliteInstallationMarkerStore(sqlite))
} finally {
  sqlite.close()
}
