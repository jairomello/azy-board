/**
 * Guard da política de testes do frontend.
 *
 * Testes que apenas leem o código-fonte (ex.: `fetch(new URL('./X.tsx',
 * import.meta.url))` ou leitura de arquivo) só são aceitos quando verificam um
 * invariante não comportamental e trazem o marcador `[CONTRATO-ESTRUTURAL]` com
 * a justificativa. O objetivo é impedir que novos testes de texto-fonte entrem
 * sem revisão, substituindo comportamento real.
 *
 * Uso:
 *   bun run check:frontend-tests
 */

import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = join(import.meta.dir, '..')
const sourceRoot = join(root, 'apps', 'web', 'src')
const marker = '[CONTRATO-ESTRUTURAL]'
const sourceReadPatterns = [
  /fetch\(\s*new URL\(/,
  /readFileSync\(/,
  /Bun\.file\(/,
]

interface Finding {
  path: string
  reason: string
}

const findings: Finding[] = []

async function scan(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await scan(path)
      continue
    }
    if (!entry.isFile() || !/\.test\.(ts|tsx)$/.test(entry.name)) continue

    const content = await Bun.file(path).text()
    const readsSource = sourceReadPatterns.some(pattern => pattern.test(content))
    if (!readsSource) continue
    if (content.includes(marker)) continue

    findings.push({ path: relative(root, path), reason: 'lê o código-fonte sem o marcador ' + marker })
  }
}

await scan(sourceRoot)

if (findings.length > 0) {
  console.error(`Testes de frontend lendo o código-fonte sem justificativa (${findings.length}):`)
  for (const finding of findings) console.error(`  - ${finding.path}: ${finding.reason}`)
  console.error(
    '\nMigre para um teste de comportamento/componente ou, se for um invariante não comportamental,',
  )
  console.error(`adicione o comentário ${marker} <motivo> no arquivo.`)
  process.exit(1)
}

console.log('Política de testes de frontend respeitada.')
