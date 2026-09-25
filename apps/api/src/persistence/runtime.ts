import { resolveInstallProfile } from '../db/installProfile'

// [DB-SWAP] Composition root: seleciona adapter por perfil de instalação.
// SIMPLE → SQLite (bun:sqlite + drizzle)
// ADVANCED → PostgreSQL (pg pool + SQL bruto)
// O fallback silencioso para SQLite é proibido: erro em ADVANCED é fatal.

const profile = resolveInstallProfile()

function createPersistence() {
  if (profile.profile === 'SIMPLE') {
    const { db, sqlite } = require('../db') as typeof import('../db')
    const { createSqlitePersistencePorts } = require('../db/sqlite/adapter') as typeof import('../db/sqlite/adapter')
    return createSqlitePersistencePorts(db, sqlite)
  }
  // ADVANCED
  const { createPostgresPool } = require('../db/postgres') as typeof import('../db/postgres')
  const { createPostgresPersistencePorts } = require('../db/postgres/adapter') as typeof import('../db/postgres/adapter')
  const pool = createPostgresPool(profile)
  return createPostgresPersistencePorts(pool)
}

export const persistence = createPersistence()
