import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database as BunDatabase } from 'bun:sqlite'
import * as schema from './schema'
import { resolveInstallProfile } from './installProfile'
import { preflightInstallationMarkers, preflightVolumeMarker } from './installationMarkers'

// [DB-SWAP] Este módulo é somente o adapter SIMPLE (SQLite). ADVANCED precisa
// de imports, schema, pool, migrations e auditoria PostgreSQL próprios; não é
// seguro trocar apenas o driver ou reutilizar o schema sqlite-core.

export const installProfile = resolveInstallProfile()

if (installProfile.profile !== 'SIMPLE') {
  throw new Error('ADVANCED_DATABASE_ADAPTER_NOT_READY: refusing to open a PostgreSQL installation with the SQLite driver.')
}

// Recusa troca de perfil/URL com base no marcador persistente antes de criar
// ou modificar o arquivo SQLite (inclusive a alteração de journal_mode abaixo).
preflightVolumeMarker(installProfile)

// [DB-SWAP] Criar conexão Bun SQLite somente depois de validar perfil SIMPLE.
export const sqlite = new BunDatabase(installProfile.databaseUrl)

// Se a base já tem marcador, ele também precisa corresponder ao volume antes
// de qualquer PRAGMA ou consulta da aplicação.
preflightInstallationMarkers(installProfile, sqlite)

// Habilitar WAL mode para melhor performance de escrita concorrente no SQLite
// [DB-SWAP] WAL e PRAGMA são exclusivamente SIMPLE; o adapter PostgreSQL não executa comandos SQLite.
sqlite.exec('PRAGMA journal_mode = WAL;')
sqlite.exec('PRAGMA foreign_keys = ON;')

export const db = drizzle(sqlite, { schema })

export type DrizzleDb = typeof db
