import { Client } from 'pg'

// Os testes que dependem de PostgreSQL rodam apenas quando há banco disponível:
// com TEST_PG_URL definido (job `advanced` do CI) eles são obrigatórios; sem ele,
// rodam contra o Postgres local se ele responder e são pulados caso contrário,
// mantendo `bun run check` sem serviços externos (docs/ci.md).
export async function shouldRunPostgresTests(pgUrl: string): Promise<boolean> {
  if (process.env.TEST_PG_URL) return true
  const client = new Client({ connectionString: pgUrl, connectionTimeoutMillis: 2_000 })
  try {
    await client.connect()
    await client.end()
    return true
  } catch {
    console.log('PostgreSQL indisponível — pulando testes que dependem do banco.')
    return false
  }
}
