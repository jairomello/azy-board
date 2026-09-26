/**
 * Verificação de coerência da versão do Bun do deploy.
 *
 * Uso: bun run check:deploy-versions
 *
 * Reprova quando a versão fixada em `.bun-version` diverge do `ARG
 * BUN_VERSION`/tags dos Dockerfiles ou quando o workflow do CI não usa
 * `bun-version-file: .bun-version`. Tags flutuantes de runtime (ex.:
 * `oven/bun:1-alpine`) são reprovadas em qualquer Dockerfile.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const problemas: string[] = []

const versao = readFileSync(join(root, '.bun-version'), 'utf8').trim()
if (!/^\d+\.\d+\.\d+$/.test(versao)) {
  problemas.push(`.bun-version com formato inválido: "${versao}"`)
}

for (const arquivo of ['Dockerfile', 'Dockerfile.web']) {
  const conteudo = readFileSync(join(root, arquivo), 'utf8')
  const arg = conteudo.match(/^ARG BUN_VERSION=(\S+)$/m)?.[1]
  if (arg !== versao) {
    problemas.push(`${arquivo}: ARG BUN_VERSION="${arg}" difere de .bun-version "${versao}"`)
  }
  const tags = conteudo.match(/oven\/bun:[^\s]+/g) ?? []
  for (const tag of tags) {
    if (tag !== 'oven/bun:${BUN_VERSION}-alpine') {
      problemas.push(`${arquivo}: tag de Bun fora do padrão "oven/bun:\${BUN_VERSION}-alpine": "${tag}"`)
    }
  }
}

const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
const usosSetupBun = workflow.split('oven-sh/setup-bun').length - 1
const declaracoesVersionFile = workflow.split('bun-version-file: .bun-version').length - 1
if (usosSetupBun === 0) {
  problemas.push('ci.yml: nenhum uso de oven-sh/setup-bun encontrado')
} else if (usosSetupBun !== declaracoesVersionFile) {
  problemas.push(
    `ci.yml: ${usosSetupBun} usos de setup-bun mas ${declaracoesVersionFile} declarações de bun-version-file: .bun-version`,
  )
}

if (problemas.length > 0) {
  console.error('Coerência da versão do Bun no deploy FALHOU:')
  for (const problema of problemas) console.error(`  - ${problema}`)
  process.exit(1)
}
console.log(`Coerência OK: Bun ${versao} em .bun-version, Dockerfiles e workflow do CI.`)
