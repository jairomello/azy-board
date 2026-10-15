// Conteúdo da central de ajuda e da documentação consultada pelo Azy Agent.
//
// Fonte única: a wiki versionada em `docs/azyboard-wiki` (papel definido em
// `docs/README.md`). O escopo exposto — o que aparece na central de ajuda e o
// que o agente pode consultar — é declarado AQUI e só aqui; nenhum outro ponto
// do código mantém uma lista própria de módulos, páginas ou exclusões.
//
// Regras do escopo:
// - expõe o manual funcional do produto: módulos `00`–`09`;
// - expõe a capa do manual (`Home.md`), único arquivo fora de módulo;
// - nunca expõe `controle/` (controle editorial), `modelos/` (padronização de
//   escrita) nem `.obsidian/` (configuração do cofre de markdown);
// - remove das páginas a seção técnica recolhível (`<details>`), que descreve
//   implementação e não pertence ao manual do usuário.
//
// [TENANT] Documentação de produto é a mesma para todos os tenants: não há
// dado de negócio aqui e nenhuma query é executada. O isolamento cross-tenant
// não se aplica; a exigência de acesso é apenas sessão autenticada (ver
// routes/help.ts).
import { createHash } from 'node:crypto'
import { existsSync, type Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { normalizeTerms } from './termNormalization'

/** Módulos da wiki expostos na ajuda e ao Azy Agent (manual funcional). */
export const HELP_MODULE_IDS = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'] as const

/** Único arquivo exposto fora dos módulos: a capa do manual. */
export const HELP_HOME_PATH = 'Home.md'

/** Diretórios do cofre que nunca integram o conteúdo servido. */
export const HELP_EXCLUDED_DIRECTORIES = ['controle', 'modelos', '.obsidian'] as const

/** Teto de resultados da busca usada pelo Azy Agent. */
export const HELP_SEARCH_MAX_RESULTS = 5

/** Teto de caracteres da consulta de busca. */
export const HELP_SEARCH_MAX_QUERY_LENGTH = 500

// Candidatos relativos ao cwd: raiz do repo em dev, `/app` na imagem e
// `apps/api` em runners locais (mesmo espírito de resolveSkillDir).
const HELP_DIR_CANDIDATES = ['docs/azyboard-wiki', '../../docs/azyboard-wiki', '../docs/azyboard-wiki']

const MODULE_DIRECTORY_RE = /^(\d{2}) - (.+)$/
const TECHNICAL_BLOCK_RE = /<details\b[^>]*>[\s\S]*?<\/details>\s*/gi
const EMBED_RE = /!\[\[[^\]]*\]\]/g
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export type HelpPageSummary = { slug: string; title: string; order: number; path: string }
export type HelpModuleSummary = { id: string; title: string; order: number; pages: HelpPageSummary[] }
export type HelpIndex = { version: string; home: HelpPageSummary | null; modules: HelpModuleSummary[] }
export type HelpPage = HelpPageSummary & { moduleId: string | null; moduleTitle: string | null; sha256: string; markdown: string }
export type HelpContent = { index: HelpIndex; pages: HelpPage[] }
export type HelpContentResult = { ok: true; content: HelpContent } | { ok: false; code: 'HELP_UNAVAILABLE' }
export type HelpSearchHit = { slug: string; title: string; moduleTitle: string; score: number; excerpt: string }

type RawPage = {
  slug: string
  title: string
  order: number
  relativePath: string
  source: string
  body: string
  moduleId: string | null
  moduleTitle: string | null
  isModuleLanding: boolean
}

type ModuleDirectory = { id: string; directory: string; label: string }

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// ── Resolução do diretório da documentação ──────────────────────────────────
/** Resolve o diretório da wiki: env explícita ou candidatos relativos ao cwd. */
export function resolveHelpDir(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.AZYBOARD_HELP_DIR?.trim()
  if (configured) return existsSync(configured) ? configured : null
  for (const candidate of HELP_DIR_CANDIDATES) {
    if (existsSync(join(candidate, HELP_HOME_PATH))) return candidate
  }
  return null
}

// ── Frontmatter e texto ─────────────────────────────────────────────────────
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) return { meta: {}, body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end < 0) return { meta: {}, body: raw }
  const header = raw.slice(3, end)
  const bodyStart = raw.indexOf('\n', end + 1)
  const body = bodyStart < 0 ? '' : raw.slice(bodyStart + 1)
  const meta: Record<string, string> = {}
  for (const line of header.split('\n')) {
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
    if (key) meta[key] = value
  }
  return { meta, body }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function firstHeading(body: string): string | null {
  const match = /^#{1,6}\s+(.+)$/m.exec(body)
  return match ? match[1]!.trim() : null
}

function normalizeTarget(value: string): string {
  return value.normalize('NFC').trim()
}

/** Texto corrido para o trecho da busca (sem sintaxe de Markdown). */
export function helpPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Construção das páginas ──────────────────────────────────────────────────
function buildRawPage(input: {
  relativePath: string
  source: string
  moduleId: string | null
  moduleTitle: string | null
  isModuleLanding: boolean
}): RawPage {
  const { meta, body } = parseFrontmatter(input.source)
  const withoutTechnical = body.replace(TECHNICAL_BLOCK_RE, '').trim()
  const fileName = input.relativePath.split('/').pop()!.replace(/\.md$/i, '')
  return {
    slug: input.moduleId ? `${input.moduleId}-${slugify(fileName)}` : slugify(fileName),
    title: meta.title?.trim() || firstHeading(withoutTechnical) || fileName,
    order: Number.parseInt(meta.order ?? '', 10) || 0,
    relativePath: input.relativePath,
    source: input.source,
    body: withoutTechnical,
    moduleId: input.moduleId,
    moduleTitle: input.moduleTitle,
    isModuleLanding: input.isModuleLanding,
  }
}

async function readModulePages(dir: string, module: ModuleDirectory): Promise<RawPage[]> {
  const absolute = join(dir, module.directory)
  const entries = await readdir(absolute, { withFileTypes: true })
  const files = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
  const raw = await Promise.all(files.map(async entry => ({
    name: entry.name,
    source: await readFile(join(absolute, entry.name), 'utf8'),
  })))
  const landingName = `${module.label}.md`
  const landing = raw.find(item => item.name === landingName)
  const moduleTitle = landing ? parseFrontmatter(landing.source).meta.title?.trim() || module.label : module.label
  return raw
    .map(item => buildRawPage({
      relativePath: `${module.directory}/${item.name}`,
      source: item.source,
      moduleId: module.id,
      moduleTitle,
      isModuleLanding: item.name === landingName,
    }))
    .sort((a, b) => Number(b.isModuleLanding) - Number(a.isModuleLanding) || a.order - b.order || a.title.localeCompare(b.title, 'pt-BR'))
}

function listModuleDirectories(entries: Dirent[]): ModuleDirectory[] {
  const modules: ModuleDirectory[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if ((HELP_EXCLUDED_DIRECTORIES as readonly string[]).includes(entry.name)) continue
    const match = MODULE_DIRECTORY_RE.exec(entry.name)
    if (!match) continue
    if (!(HELP_MODULE_IDS as readonly string[]).includes(match[1]!)) continue
    modules.push({ id: match[1]!, directory: entry.name, label: match[2]! })
  }
  return modules.sort((a, b) => a.id.localeCompare(b.id))
}

// ── Links internos ──────────────────────────────────────────────────────────
function buildLinkTargets(pages: readonly RawPage[]): Map<string, string> {
  const targets = new Map<string, string>()
  const byBasename = new Map<string, string | null>()
  for (const page of pages) {
    const key = normalizeTarget(page.relativePath.replace(/\.md$/i, ''))
    targets.set(key, page.slug)
    const basename = key.split('/').pop() ?? key
    byBasename.set(basename, byBasename.has(basename) ? null : page.slug)
  }
  // Links sem diretório (ex.: [[Home]]) resolvem só quando o nome é inequívoco.
  for (const [basename, slug] of byBasename) {
    if (slug && !targets.has(basename)) targets.set(basename, slug)
  }
  return targets
}

function resolveWikiLinks(markdown: string, targets: ReadonlyMap<string, string>): string {
  return markdown
    .replace(EMBED_RE, '')
    .replace(WIKILINK_RE, (_match, rawTarget: string, rawLabel?: string) => {
      const target = normalizeTarget(rawTarget)
      const label = (rawLabel ?? target.split('/').pop() ?? target).trim()
      const slug = targets.get(target) ?? targets.get(target.replace(/\.md$/i, ''))
      // Alvo fora do escopo exposto vira texto simples: não há página para abrir.
      return slug ? `[${label}](/help/${slug})` : label
    })
}

// ── Leitura completa ────────────────────────────────────────────────────────
async function readHelpContent(dir: string): Promise<HelpContentResult> {
  const entries = await readdir(dir, { withFileTypes: true })
  const rawPages: RawPage[] = []

  const homePath = join(dir, HELP_HOME_PATH)
  if (existsSync(homePath)) {
    rawPages.push(buildRawPage({
      relativePath: HELP_HOME_PATH,
      source: await readFile(homePath, 'utf8'),
      moduleId: null,
      moduleTitle: null,
      isModuleLanding: false,
    }))
  }

  const moduleSummaries: Array<{ id: string; title: string; pages: RawPage[] }> = []
  for (const module of listModuleDirectories(entries)) {
    const pages = await readModulePages(dir, module)
    if (!pages.length) continue
    moduleSummaries.push({ id: module.id, title: pages.find(page => page.isModuleLanding)?.title ?? module.label, pages })
    rawPages.push(...pages)
  }

  if (!rawPages.length) return { ok: false, code: 'HELP_UNAVAILABLE' }

  const targets = buildLinkTargets(rawPages)
  const pages: HelpPage[] = rawPages.map(page => ({
    slug: page.slug,
    title: page.title,
    order: page.order,
    path: page.relativePath,
    moduleId: page.moduleId,
    moduleTitle: page.moduleTitle,
    sha256: hash(page.source),
    markdown: resolveWikiLinks(page.body, targets),
  }))

  const summary = (page: RawPage): HelpPageSummary => ({ slug: page.slug, title: page.title, order: page.order, path: page.relativePath })
  const home = rawPages.find(page => page.slug === 'home')
  const index: HelpIndex = {
    version: hash(pages.map(page => page.sha256).join('')),
    home: home ? summary(home) : null,
    modules: moduleSummaries.map(module => ({
      id: module.id,
      title: module.title,
      order: Number.parseInt(module.id, 10),
      pages: module.pages.map(summary),
    })),
  }
  return { ok: true, content: { index, pages } }
}

let cached: { dir: string; result: HelpContentResult } | null = null

/**
 * Carrega o conteúdo da ajuda. A leitura acontece uma única vez por diretório e
 * fica em memória; quando a documentação não está disponível, devolve
 * `HELP_UNAVAILABLE` em vez de lançar.
 */
export async function loadHelpContent(options: { dir?: string | null; force?: boolean } = {}): Promise<HelpContentResult> {
  const dir = options.dir === undefined ? resolveHelpDir() : options.dir
  if (!dir) return { ok: false, code: 'HELP_UNAVAILABLE' }
  if (!options.force && cached?.dir === dir) return cached.result
  let result: HelpContentResult
  try {
    result = await readHelpContent(dir)
  } catch {
    result = { ok: false, code: 'HELP_UNAVAILABLE' }
  }
  cached = { dir, result }
  return result
}

/** Página do escopo exposto, ou `null` quando o slug não pertence à ajuda. */
export function findHelpPage(content: HelpContent, slug: string): HelpPage | null {
  return content.pages.find(page => page.slug === slug) ?? null
}

/** Busca lexical por página: sem embeddings e sem acesso a fonte externa. */
export function searchHelpContent(content: HelpContent, query: string, limit = HELP_SEARCH_MAX_RESULTS): HelpSearchHit[] {
  const terms = [...new Set(normalizeTerms(query.slice(0, HELP_SEARCH_MAX_QUERY_LENGTH)))]
  if (!terms.length) return []
  const capped = Math.max(1, Math.min(limit, HELP_SEARCH_MAX_RESULTS))
  return content.pages
    .map(page => {
      const titleTerms = normalizeTerms(`${page.title} ${page.moduleTitle ?? ''}`)
      const bodyTerms = normalizeTerms(page.markdown)
      const score = terms.reduce((total, term) => total + (titleTerms.includes(term) ? 3 : 0) + (bodyTerms.includes(term) ? 1 : 0), 0)
      return { slug: page.slug, title: page.title, moduleTitle: page.moduleTitle ?? '', score, excerpt: helpPlainText(page.markdown).slice(0, 240) }
    })
    .filter(hit => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, capped)
}
