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

// Compose de produção: nenhuma imagem pode usar tag flutuante. Referências com
// variável (`:${AZYBOARD_IMAGE_TAG:-latest}`) são resolvidas pelo deploy para uma
// tag de commit e ficam fora desta checagem.
const TAGS_FLUTUANTES = ['latest', 'stable', 'edge']
const composeProducao = readFileSync(join(root, 'docker-compose.production.yml'), 'utf8')
let servicoAtual = ''
for (const linha of composeProducao.split('\n')) {
  const cabecalho = linha.match(/^ {2}([A-Za-z0-9_-]+):\s*$/)
  if (cabecalho) {
    servicoAtual = cabecalho[1]
    continue
  }
  const referencia = linha.match(/^\s+image:\s*(\S+)\s*$/)?.[1]
  if (!referencia || referencia.includes('${')) continue
  const semDigest = referencia.split('@')[0]!
  const barra = semDigest.lastIndexOf('/')
  const ultimoSegmento = semDigest.slice(barra + 1)
  const doisPontos = ultimoSegmento.indexOf(':')
  // Caminho do repositório sem a tag, para o exemplo da mensagem ficar correto
  // mesmo quando a tag flutuante já está presente.
  const caminho = doisPontos === -1 ? semDigest : `${semDigest.slice(0, barra + 1)}${ultimoSegmento.slice(0, doisPontos)}`
  const tag = doisPontos === -1 ? '' : ultimoSegmento.slice(doisPontos + 1)
  if (tag === '') {
    problemas.push(`docker-compose.production.yml: serviço "${servicoAtual}" sem tag de versão na imagem "${referencia}"`)
  } else if (TAGS_FLUTUANTES.includes(tag)) {
    problemas.push(`docker-compose.production.yml: serviço "${servicoAtual}" usa tag flutuante "${tag}" em "${referencia}" (use versão concreta, ex.: "${caminho}:1.2.3")`)
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

// T60 — a versão do build precisa chegar aos artefatos publicados: sem isso o
// bundle do web e o .build-info.json da imagem caem no fallback 'dev'.
const ARGS_DA_VERSAO = ['AZYBOARD_BUILD_VERSION', 'AZYBOARD_BUILD_DATE']
for (const arquivo of ['Dockerfile', 'Dockerfile.web']) {
  const conteudo = readFileSync(join(root, arquivo), 'utf8')
  for (const arg of ARGS_DA_VERSAO) {
    if (!new RegExp(`^ARG ${arg}=`, 'm').test(conteudo)) {
      problemas.push(`${arquivo}: falta "ARG ${arg}=" para transportar a versão do build`)
    }
    if (!new RegExp(`^ENV ${arg}=\\$\\{${arg}\\}`, 'm').test(conteudo)) {
      problemas.push(`${arquivo}: "${arg}" não é repassado ao build ("ENV ${arg}=\${${arg}}")`)
    }
  }
}

const jobPublicacao = workflow.split('publish-production-images:')[1] ?? ''
if (!jobPublicacao.includes('scripts/build-version.ts')) {
  problemas.push('ci.yml: o job de publicação de imagens não calcula a versão do build (scripts/build-version.ts)')
}
for (const [alvo, marcador] of [['API', 'Dockerfile'], ['web', 'Dockerfile.web']] as const) {
  const bloco = jobPublicacao.split(`file: ${marcador}`)[1] ?? ''
  for (const arg of ARGS_DA_VERSAO) {
    // Montado por concatenação: `${{` dentro de template literal iniciaria interpolação.
    const repasse = arg + '=${{ steps.'
    if (!bloco.includes(repasse)) {
      problemas.push(`ci.yml: a imagem da ${alvo} não recebe ${arg} como build-arg no job de publicação`)
    }
  }
}

if (problemas.length > 0) {
  console.error('Coerência da versão do Bun e do build no deploy FALHOU:')
  for (const problema of problemas) console.error(`  - ${problema}`)
  process.exit(1)
}
console.log(`Coerência OK: Bun ${versao} em .bun-version, Dockerfiles e workflow do CI; versão do build transportada nos dois artefatos.`)
