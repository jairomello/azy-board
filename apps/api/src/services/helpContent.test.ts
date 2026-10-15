import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  HELP_EXCLUDED_DIRECTORIES,
  HELP_MODULE_IDS,
  HELP_SEARCH_MAX_RESULTS,
  findHelpPage,
  loadHelpContent,
  resolveHelpDir,
  searchHelpContent,
} from './helpContent'

// ── Wiki real do repositório ────────────────────────────────────────────────
describe('conteúdo da ajuda a partir da wiki versionada', () => {
  test('expõe os módulos do manual na ordem da fonte, com título e páginas', async () => {
    const result = await loadHelpContent({ force: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { index, pages } = result.content
    expect(index.modules.map(module => module.id)).toEqual([...HELP_MODULE_IDS])
    expect(index.modules.every(module => module.pages.length > 0)).toBe(true)
    expect(index.modules.every(module => module.title.trim().length > 0)).toBe(true)
    expect(index.modules.map(module => module.order)).toEqual([...HELP_MODULE_IDS].map(Number))
    expect(index.home?.slug).toBe('home')
    expect(pages.length).toBeGreaterThan(60)
  })

  test('a página de módulo vem primeiro e as demais seguem a ordem do frontmatter', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    const board = result.content.index.modules.find(module => module.id === '04')!
    expect(board.pages[0]!.slug).toBe('04-board-e-visualizacoes')
    expect(board.title).toBe('Board e Visualizações')
    const orders = board.pages.slice(1).map(page => page.order)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  test('deriva slug estável e legível a partir do caminho', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    const page = findHelpPage(result.content, '04-conhecer-o-board')
    expect(page?.path).toBe('04 - Board e Visualizacoes/Conhecer o Board.md')
    expect(page?.title).toBe('Conhecer o Board')
    expect(findHelpPage(result.content, '00-glossario')?.path).toBe('00 - Inicio/Glossario.md')
    expect(findHelpPage(result.content, '10-referencia')).toBeNull()
  })

  test('cada página traz a origem e o hash do documento', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    for (const page of result.content.pages) {
      expect(page.path.endsWith('.md')).toBe(true)
      expect(page.sha256).toHaveLength(64)
    }
    expect(result.content.index.version).toHaveLength(64)
  })
})

// ── Escopo exposto (verificação automatizada) ───────────────────────────────
describe('escopo da ajuda', () => {
  test('nenhuma página servida vem de controle/, modelos/ ou .obsidian/', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    for (const page of result.content.pages) {
      const top = page.path.split('/')[0]!
      expect((HELP_EXCLUDED_DIRECTORIES as readonly string[]).includes(top)).toBe(false)
      expect(page.path).not.toContain('.obsidian')
    }
  })

  test('nenhuma seção técnica recolhível integra o conteúdo servido', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    for (const page of result.content.pages) {
      expect(page.markdown.toLowerCase()).not.toContain('<details')
      expect(page.markdown.toLowerCase()).not.toContain('<summary')
    }
    // Frase que existe apenas dentro do bloco técnico de "Conhecer o Board".
    const board = findHelpPage(result.content, '04-conhecer-o-board')!
    expect(board.markdown).not.toContain('O Board utiliza contextos de drag-and-drop para cards e colunas.')
    expect(board.markdown).toContain('## Onde encontrar')
  })
})

// ── Fixture: as regras de exclusão valem para qualquer wiki ─────────────────
const fixtureRoot = mkdtempSync(join(tmpdir(), 'azy-help-'))

function writeFixture(relativePath: string, content: string): void {
  const absolute = join(fixtureRoot, relativePath)
  mkdirSync(join(absolute, '..'), { recursive: true })
  writeFileSync(absolute, content, 'utf8')
}

writeFixture('Home.md', [
  '---', 'title: Azy Board', 'type: home', 'order: 0', '---', '',
  '# Azy Board', '',
  'Veja [[00 - Inicio/Glossario|o glossário]] e [[10 - Referencia/Modelo de Dados|o modelo]].', '',
  '<details>', '<summary><strong>Como funciona tecnicamente</strong></summary>', '',
  'SEGREDO TECNICO', '', '</details>', '',
].join('\n'))
writeFixture('00 - Inicio/Glossario.md', [
  '---', 'title: Glossário', 'type: guide', 'order: 1', '---', '',
  '# Glossário', '', 'Termos do produto.', '',
].join('\n'))
writeFixture('controle/Matriz de Cobertura Editorial.md', [
  '---', 'title: Matriz de Cobertura Editorial', 'type: internal', 'order: 0', '---', '',
  '# Matriz', '', 'DOCUMENTO INTERNO', '',
].join('\n'))
writeFixture('modelos/Convencoes Editoriais.md', [
  '---', 'title: Convenções Editoriais', 'type: internal', 'order: 1', '---', '',
  '# Convenções', '', 'PADRAO INTERNO', '',
].join('\n'))
writeFixture('.obsidian/app.json', '{ "legacyEditor": false }\n')
writeFixture('11 - Futuro/Novo.md', [
  '---', 'title: Novo', 'type: guide', 'order: 1', '---', '', '# Novo', '', 'FORA DO ESCOPO', '',
].join('\n'))

afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }))

describe('regras de escopo sobre uma wiki qualquer', () => {
  test('exclui documentos internos, configuração do cofre e módulos fora da faixa', async () => {
    const result = await loadHelpContent({ dir: fixtureRoot, force: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const paths = result.content.pages.map(page => page.path)
    expect(paths).toEqual(['Home.md', '00 - Inicio/Glossario.md'])
    const markdown = result.content.pages.map(page => page.markdown).join('\n')
    expect(markdown).not.toContain('DOCUMENTO INTERNO')
    expect(markdown).not.toContain('PADRAO INTERNO')
    expect(markdown).not.toContain('FORA DO ESCOPO')
    expect(markdown).not.toContain('SEGREDO TECNICO')
    expect(markdown).not.toContain('<details')
    expect(result.content.index.modules.map(module => module.id)).toEqual(['00'])
  })

  test('resolve wikilink interno e desfaz o link para alvo fora do escopo', async () => {
    const result = await loadHelpContent({ dir: fixtureRoot })
    if (!result.ok) throw new Error('ajuda indisponível')
    const home = findHelpPage(result.content, 'home')!
    expect(home.markdown).toContain('[o glossário](/help/00-glossario)')
    expect(home.markdown).toContain('o modelo')
    expect(home.markdown).not.toContain('/help/10-referencia')
  })
})

// ── Busca do Azy Agent ──────────────────────────────────────────────────────
describe('busca lexical na documentação', () => {
  test('ranqueia a página mais aderente e limita o número de resultados', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    const hits = searchHelpContent(result.content, 'como criar uma task e editar um bug')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.length).toBeLessThanOrEqual(HELP_SEARCH_MAX_RESULTS)
    expect(hits[0]!.score).toBeGreaterThanOrEqual(hits[hits.length - 1]!.score)
    expect(hits.every(hit => hit.excerpt.length > 0)).toBe(true)
  })

  test('ignora consulta vazia e devolve nada quando não há correspondência', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    expect(searchHelpContent(result.content, '   ')).toEqual([])
    expect(searchHelpContent(result.content, 'xilofone quarup zzzz')).toEqual([])
  })

  test('respeita o teto de resultados mesmo quando o pedido é maior', async () => {
    const result = await loadHelpContent()
    if (!result.ok) throw new Error('ajuda indisponível')
    expect(searchHelpContent(result.content, 'board projeto task sprint', 99).length).toBeLessThanOrEqual(HELP_SEARCH_MAX_RESULTS)
  })
})

// ── Indisponibilidade e resolução de diretório ──────────────────────────────
describe('indisponibilidade da documentação', () => {
  test('resolve o diretório por env e por candidatos relativos ao cwd', () => {
    expect(resolveHelpDir({ AZYBOARD_HELP_DIR: fixtureRoot })).toBe(fixtureRoot)
    expect(resolveHelpDir({ AZYBOARD_HELP_DIR: join(fixtureRoot, 'inexistente') })).toBeNull()
    const fromCwd = resolveHelpDir({})
    expect(fromCwd).not.toBeNull()
    expect(fromCwd!.endsWith('docs/azyboard-wiki')).toBe(true)
    expect(existsSync(join(fromCwd!, 'Home.md'))).toBe(true)
  })

  test('devolve HELP_UNAVAILABLE sem lançar quando o diretório não existe', async () => {
    const result = await loadHelpContent({ dir: join(fixtureRoot, 'inexistente'), force: true })
    expect(result).toEqual({ ok: false, code: 'HELP_UNAVAILABLE' })
    expect(await loadHelpContent({ dir: null })).toEqual({ ok: false, code: 'HELP_UNAVAILABLE' })
  })

  test('devolve HELP_UNAVAILABLE quando o diretório não tem páginas do escopo', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'azy-help-empty-'))
    try {
      writeFileSync(join(empty, 'Home.md'), 'sem frontmatter\n', 'utf8')
      rmSync(join(empty, 'Home.md'))
      expect(await loadHelpContent({ dir: empty, force: true })).toEqual({ ok: false, code: 'HELP_UNAVAILABLE' })
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
