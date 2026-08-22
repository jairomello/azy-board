const baseUrl = (Bun.env.SMOKE_URL ?? 'http://localhost:5173').replace(/\/+$/, '')

async function assertStatus(path: string, expected: number) {
  const response = await fetch(`${baseUrl}${path}`)
  if (response.status !== expected) {
    throw new Error(`${path}: esperado HTTP ${expected}, recebido HTTP ${response.status}`)
  }
  console.log(`OK ${path} -> ${response.status}`)
}

await assertStatus('/', 200)
await assertStatus('/api/auth/me', 401)
console.log(`Smoke test concluído: ${baseUrl}`)
