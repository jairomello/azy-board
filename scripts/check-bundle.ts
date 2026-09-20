import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

// Verifica o orçamento de bundle do web a partir dos assets gerados em
// apps/web/dist/assets. Os limites são expressos em bytes gzip porque é o
// tamanho efetivamente transferido ao usuário. O orçamento versionado vive em
// apps/web/bundle-budget.json e casa por prefixo do nome do chunk.

const root = join(import.meta.dir, '..')
const assetsDir = join(root, 'apps', 'web', 'dist', 'assets')
const budgetPath = join(root, 'apps', 'web', 'bundle-budget.json')

interface BudgetRule {
  name: string
  maxGzipBytes: number
}

interface Budget {
  chunks: BudgetRule[]
}

interface MeasuredChunk {
  file: string
  name: string
  rawBytes: number
  gzipBytes: number
}

export function chunkName(file: string): string {
  return file.replace(/\.js$/, '').replace(/-[A-Za-z0-9_-]{8}$/, '')
}

export function matchRule(measured: string, rules: BudgetRule[]): BudgetRule | undefined {
  return rules
    .filter(rule => measured === rule.name || measured.startsWith(`${rule.name}-`) || measured.startsWith(`${rule.name}.`))
    .sort((a, b) => b.name.length - a.name.length)[0]
}

async function gzipSize(path: string): Promise<number> {
  const file = Bun.file(path)
  return Bun.gzipSync(new Uint8Array(await file.arrayBuffer())).length
}

export async function measureChunks(): Promise<MeasuredChunk[]> {
  const files = (await readdir(assetsDir)).filter(file => file.endsWith('.js')).sort()
  return Promise.all(files.map(async file => {
    const path = join(assetsDir, file)
    const rawBytes = Bun.file(path).size
    return { file, name: chunkName(file), rawBytes, gzipBytes: await gzipSize(path) }
  }))
}

export function parseBudget(value: unknown): Budget {
  if (!value || typeof value !== 'object') throw new Error('orçamento inválido: esperado um objeto JSON')
  const chunks = (value as { chunks?: unknown }).chunks
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error('orçamento inválido: "chunks" deve ser uma lista não vazia')
  const parsed: BudgetRule[] = chunks.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`orçamento inválido: chunk #${index} não é um objeto`)
    const { name, maxGzipBytes } = entry as { name?: unknown; maxGzipBytes?: unknown }
    if (typeof name !== 'string' || !name.trim()) throw new Error(`orçamento inválido: chunk #${index} sem "name"`)
    if (typeof maxGzipBytes !== 'number' || !Number.isFinite(maxGzipBytes) || maxGzipBytes <= 0) throw new Error(`orçamento inválido: chunk "${name}" sem "maxGzipBytes" numérico positivo`)
    return { name, maxGzipBytes }
  })
  return { chunks: parsed }
}

function format(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`
}

export async function run(): Promise<number> {
  let budget: Budget
  try {
    budget = parseBudget(await Bun.file(budgetPath).json())
  } catch (error) {
    console.error(`Falha ao ler o orçamento de bundle em ${budgetPath}: ${(error as Error).message}`)
    return 1
  }

  let chunks: MeasuredChunk[]
  try {
    chunks = await measureChunks()
  } catch {
    console.error(`Nenhum asset encontrado em ${assetsDir}. Rode "bun run build:web" antes de "bun run check:bundle".`)
    return 1
  }

  const failures: string[] = []
  console.log('Chunk                                |     gzip |    limite | status')
  console.log('-------------------------------------|----------|-----------|--------')
  for (const chunk of chunks) {
    const rule = matchRule(chunk.name, budget.chunks)
    if (!rule) {
      console.log(`${chunk.file.padEnd(36)} | ${format(chunk.gzipBytes).padStart(8)} | ${'—'.padStart(9)} | sem regra`)
      continue
    }
    const overflow = chunk.gzipBytes > rule.maxGzipBytes
    console.log(`${chunk.file.padEnd(36)} | ${format(chunk.gzipBytes).padStart(8)} | ${format(rule.maxGzipBytes).padStart(9)} | ${overflow ? 'ESTOUROU' : 'ok'}`)
    if (overflow) failures.push(`${chunk.file} (chunk "${rule.name}"): ${format(chunk.gzipBytes)} > limite ${format(rule.maxGzipBytes)}`)
  }

  for (const rule of budget.chunks) {
    if (!chunks.some(chunk => matchRule(chunk.name, budget.chunks) === rule)) failures.push(`nenhum chunk encontrado para a regra "${rule.name}"`)
  }

  if (failures.length) {
    console.error('\nOrçamento de bundle violado:')
    for (const failure of failures) console.error(`- ${failure}`)
    return 1
  }

  console.log('\nOrçamento de bundle respeitado.')
  return 0
}

if (import.meta.main) {
  process.exit(await run())
}
