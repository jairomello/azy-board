import { Database } from 'bun:sqlite'
import { integrityReport } from '../db/integrity'

// Uso: DATABASE_URL=/caminho/azyboard.db bun run apps/api/src/scripts/auditIntegrity.ts
const dbPath = process.env.DATABASE_URL ?? process.argv[2] ?? './dev.db'
const sqlite = new Database(dbPath, { readonly: true })
const report = integrityReport(sqlite)
sqlite.close()

console.log(JSON.stringify({ database: dbPath, ...report }, null, 2))
if (!report.ok) process.exitCode = 1
