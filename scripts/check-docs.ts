/**
 * Verificação de integridade da documentação.
 *
 * Uso: bun run check:docs
 *
 * Falha quando:
 * - um artefato gerado divergir do runtime (regeração em memória);
 * - um link interno relativo de Markdown apontar para um alvo inexistente;
 * - um documento de produto contiver uma afirmação proibida.
 */
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import {
  buildAssistantLimitsMarkdown,
  buildMcpCatalogBlock,
  buildOpenApiDocument,
  MCP_CATALOG_BEGIN,
  MCP_CATALOG_END,
} from './docs/generators'

const root = join(import.meta.dir, '..')
const problems: string[] = []

function fail(message: string) {
  problems.push(message)
}

function normalize(text: string) {
  return text.endsWith('\n') ? text : `${text}\n`
}

// --- 1. Artefatos gerados em dia -----------------------------------------

async function checkGenerated() {
  const mcpReadmePath = join(root, 'apps', 'mcp', 'README.md')
  const readme = await readFile(mcpReadmePath, 'utf8')
  const begin = readme.indexOf(MCP_CATALOG_BEGIN)
  const end = readme.indexOf(MCP_CATALOG_END)
  if (begin < 0 || end < begin) {
    fail('apps/mcp/README.md não contém o bloco gerado do catálogo. Rode `bun run generate:docs`.')
  } else {
    const actual = readme.slice(begin, end + MCP_CATALOG_END.length)
    const expected = buildMcpCatalogBlock()
    if (actual !== expected) fail('apps/mcp/README.md: catálogo MCP desatualizado. Rode `bun run generate:docs`.')
  }

  const openApiPath = join(root, 'docs', 'generated', 'openapi.json')
  if (!existsSync(openApiPath)) {
    fail('docs/generated/openapi.json ausente. Rode `bun run generate:docs`.')
  } else {
    const actual = JSON.parse(await readFile(openApiPath, 'utf8'))
    const expected = JSON.parse(JSON.stringify(buildOpenApiDocument()))
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('docs/generated/openapi.json desatualizado. Rode `bun run generate:docs`.')
  }

  const limitsPath = join(root, 'docs', 'generated', 'assistant-limits.md')
  if (!existsSync(limitsPath)) {
    fail('docs/generated/assistant-limits.md ausente. Rode `bun run generate:docs`.')
  } else {
    const actual = normalize(await readFile(limitsPath, 'utf8'))
    const expected = normalize(buildAssistantLimitsMarkdown())
    if (actual !== expected) fail('docs/generated/assistant-limits.md desatualizado. Rode `bun run generate:docs`.')
  }
}

// --- 2. Links internos -----------------------------------------------------

const scanRoots = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'TESTING.md', 'DEPLOY.md', 'DEPLOY_LABAPPS_LOCAL.md', 'SECURITY_CHECKLIST.md', 'AGENTS.md']
const scanDirs = ['docs', 'apps', 'skills']
const ignoredDirs = new Set(['node_modules', '.git', 'tmp', 'uploads', 'archive', '.obsidian', 'assets', 'dist', '__screenshots__'])

async function collectMarkdown(): Promise<string[]> {
  const files = scanRoots.map(file => join(root, file)).filter(existsSync)
  for (const dir of scanDirs) await walk(join(root, dir), files)
  return files
}

async function walk(dir: string, files: string[]) {
  if (!existsSync(dir)) return
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue
      await walk(path, files)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path)
    }
  }
}

async function checkLinks(files: string[]) {
  const linkPattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    for (const match of content.matchAll(linkPattern)) {
      const rawTarget = match[1]!
      if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget) || rawTarget.startsWith('#')) continue
      const withoutAnchor = rawTarget.split('#')[0]!.split('?')[0]!
      if (!withoutAnchor) continue
      let decoded: string
      try {
        decoded = decodeURIComponent(withoutAnchor)
      } catch {
        decoded = withoutAnchor
      }
      const target = decoded.startsWith('/') ? join(root, decoded) : resolve(dirname(file), decoded)
      if (!existsSync(target)) fail(`${relative(root, file)}: link interno quebrado -> ${rawTarget}`)
    }
  }
}

// --- 3. Afirmações proibidas ----------------------------------------------

// Documentos de produto; a auditoria (ANALISE-SISTEMA.md) cita os erros de propósito.
const forbiddenExcluded = new Set(['docs/ANALISE-SISTEMA.md'])
const forbiddenPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /every mutation goes through human approval/i, reason: 'toda mutação exige aprovação (MCP externo muta direto)' },
  { pattern: /every write operation pauses in/i, reason: 'toda escrita pausa para aprovação (MCP externo muta direto)' },
  { pattern: /CSV import with preview/i, reason: 'importação de CSV não está ligada à interface' },
  { pattern: /SQLite \(dev\) → PostgreSQL \(prod\)/i, reason: 'deploy usa SQLite; PostgreSQL não é o runtime de produção' },
  { pattern: /PostgreSQL in production/i, reason: 'deploy usa SQLite; PostgreSQL não é o runtime de produção' },
  { pattern: /4 steps, 8 tool calls/i, reason: 'limites numéricos devem vir de docs/generated/assistant-limits.md' },
]

async function checkForbidden(files: string[]) {
  for (const file of files) {
    const rel = relative(root, file)
    if (forbiddenExcluded.has(rel)) continue
    const content = await readFile(file, 'utf8')
    for (const { pattern, reason } of forbiddenPatterns) {
      if (pattern.test(content)) fail(`${rel}: afirmação proibida (${reason}).`)
    }
  }
}

await checkGenerated()
const markdownFiles = await collectMarkdown()
await checkLinks(markdownFiles)
await checkForbidden(markdownFiles)

if (problems.length > 0) {
  console.error(`Integridade da documentação: ${problems.length} problema(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('Integridade da documentação verificada.')
