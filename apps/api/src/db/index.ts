import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database as BunDatabase } from 'bun:sqlite'
import * as schema from './schema'

// [DB-SWAP] Para PostgreSQL/Supabase em produção:
//   1. npm install drizzle-orm/node-postgres pg
//   2. Trocar para: import { drizzle } from 'drizzle-orm/node-postgres'
//   3. Trocar para: import { Pool } from 'pg'
//   4. const pool = new Pool({ connectionString: process.env.DATABASE_URL })
//   5. export const db = drizzle(pool, { schema })
//
// Para Supabase especificamente:
//   DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

const dbPath = process.env.DATABASE_URL ?? './dev.db'

// [DB-SWAP] Esta linha muda ao migrar para PostgreSQL — apenas aqui
const sqlite = new BunDatabase(dbPath)

// Habilitar WAL mode para melhor performance de escrita concorrente no SQLite
sqlite.exec('PRAGMA journal_mode = WAL;')
sqlite.exec('PRAGMA foreign_keys = ON;')

export const db = drizzle(sqlite, { schema })

export type DrizzleDb = typeof db
