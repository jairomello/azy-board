/**
 * Runner de migrations do perfil ADVANCED (PostgreSQL).
 *
 * Uso: bun run db:migrate:pg   (ou `migrate` no entrypoint da imagem)
 *
 * Aplica os arquivos `*.sql` de PG_MIGRATIONS_DIR (padrão:
 * `./src/db/postgres/migrations`) em ordem lexical, cada um dentro de uma
 * transação, registrando o histórico na tabela `schema_migrations` para não
 * reaplicar arquivos já executados. Este runner é o job de migration do
 * rollout; o start da API não aplica migrations implicitamente.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const migrationsDir = process.env.PG_MIGRATIONS_DIR || './src/db/postgres/migrations'
const databaseUrl = process.env.DATABASE_URL?.trim() || ''

if (!databaseUrl) {
  throw new Error('DATABASE_URL é obrigatório para aplicar migrations no perfil ADVANCED.')
}
if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  throw new Error('DATABASE_URL deve ser uma URL PostgreSQL (perfil ADVANCED).')
}

const files = readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  throw new Error(`Nenhuma migration encontrada em ${migrationsDir}.`)
}

const client = new Client({ connectionString: databaseUrl })
await client.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const applied = await client.query('SELECT filename FROM schema_migrations')
  const done = new Set(applied.rows.map(row => (row as { filename: string }).filename))

  for (const file of files) {
    if (done.has(file)) {
      console.log(`Migration já aplicada: ${file}`)
      continue
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    console.log(`Aplicando migration: ${file}`)
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`Falha ao aplicar ${file}: ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log('Migrations PostgreSQL concluídas.')
} finally {
  await client.end()
}
