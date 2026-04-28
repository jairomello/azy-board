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
migrate(db, { migrationsFolder: './src/db/migrations' })
console.log('Migrações concluídas.')

sqlite.exec('PRAGMA foreign_keys = ON;')
sqlite.close()
