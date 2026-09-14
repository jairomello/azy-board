import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database as BunDatabase } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

// [DB-SWAP] Para PostgreSQL, trocar para 'drizzle-orm/node-postgres/migrator'

const dbPath = process.env.DATABASE_URL ?? './dev.db'
const sqlite = new BunDatabase(dbPath)

// SQLite não permite PRAGMA foreign_keys dentro de uma transaction — desativar ANTES do migrate
// [DB-SWAP] Para PostgreSQL remover estas linhas
sqlite.exec('PRAGMA foreign_keys = OFF;')

const db = drizzle(sqlite, { schema })

console.log('Executando migrações...')
// Em producao o caminho de migrations e configurado via MIGRATIONS_DIR
// (a imagem Docker move o diretorio para /app/migrations). Em dev local
// continua apontando para ./src/db/migrations como antes.
migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR || './src/db/migrations' })
console.log('Migrações concluídas.')

// Verificação pós-migration: nenhuma violação de chave estrangeira residual.
const foreignKeyViolations = sqlite.query('PRAGMA foreign_key_check').all()
if (foreignKeyViolations.length > 0) {
  sqlite.close()
  throw new Error(`Integridade referencial violada após migração: ${JSON.stringify(foreignKeyViolations.slice(0, 10))}`)
}

sqlite.exec('PRAGMA foreign_keys = ON;')
sqlite.close()
