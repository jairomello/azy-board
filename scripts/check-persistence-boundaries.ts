// [DB-SWAP] Garante que rotas e serviços de domínio não voltem a importar
// Drizzle/tabelas diretamente. O SQL e o driver ficam confinados aos adapters
// (`apps/api/src/db/**`) e ao composition root (`apps/api/src/persistence/runtime.ts`).
//
// Exceções conhecidas (helpers de seed/manutenção usados por testes; migração
// completa rastreada na change `add-installation-profiles`):
//   - apps/api/src/services/analytics.ts
//   - apps/api/src/services/dashboardMetrics.ts
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const TARGET_DIRS = ['apps/api/src/routes', 'apps/api/src/services']
const ALLOWLIST = new Set([
  'apps/api/src/services/analytics.ts',
  'apps/api/src/services/dashboardMetrics.ts',
])

const FORBIDDEN = [
  { pattern: /from\s+['"][^'"]*db\/schema['"]/, reason: 'importa tabelas Drizzle (db/schema)' },
  { pattern: /from\s+['"][^'"]*db\/index['"]/, reason: 'importa a conexão concreta (db/index)' },
  { pattern: /from\s+['"][^'"]*\/db['"]/, reason: 'importa o módulo de banco concreto (/db)' },
  { pattern: /from\s+['"]drizzle-orm(?:\/[^'"]*)?['"]/, reason: 'importa o ORM Drizzle diretamente' },
]

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(join(ROOT, dir), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(path))
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(path)
  }
  return files
}

const violations: string[] = []

for (const dir of TARGET_DIRS) {
  for (const file of await collectFiles(dir)) {
    const normalized = relative(ROOT, join(ROOT, file))
    if (ALLOWLIST.has(normalized)) continue
    const content = await readFile(join(ROOT, file), 'utf8')
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(content)) violations.push(`${normalized}: ${rule.reason}`)
    }
  }
}

if (violations.length > 0) {
  console.error('Violações de fronteira de persistência (rotas/serviços não devem importar Drizzle):')
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log('Fronteiras de persistência OK: nenhuma rota/serviço importa Drizzle ou db/schema.')
