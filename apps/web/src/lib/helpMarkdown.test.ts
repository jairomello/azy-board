import { describe, expect, test } from 'bun:test'
import { helpSlugFromHref, renderHelpMarkdown } from './helpMarkdown'

describe('renderização das páginas da ajuda', () => {
  test('wikilink resolvido pelo servidor continua como link interno da ajuda', () => {
    const html = renderHelpMarkdown('Veja [o glossário](/help/00-glossario) para os termos.')
    expect(html).toContain('href="/help/00-glossario"')
    expect(html).toContain('o glossário')
  })

  test('wikilink remanescente (alvo fora do escopo) vira texto simples', () => {
    const html = renderHelpMarkdown('Consulte [[10 - Referencia/Modelo de Dados|o modelo de dados]].')
    expect(html).toContain('o modelo de dados')
    expect(html).not.toContain('[[')
    expect(html).not.toContain('10 - Referencia')
  })

  test('embed de asset é descartado', () => {
    const html = renderHelpMarkdown('Antes\n\n![[assets/diagramas/novo.png]]\n\nDepois')
    expect(html).toContain('Antes')
    expect(html).toContain('Depois')
    expect(html).not.toContain('novo.png')
  })

  test('callout vira destaque com classe por tipo, sem expor a sintaxe', () => {
    const info = renderHelpMarkdown('> [!info] Informação\n> Contexto útil.')
    expect(info).toContain('help-callout--info')
    expect(info).toContain('Informação')
    expect(info).not.toContain('[!info]')

    const warning = renderHelpMarkdown('> [!warning] Atenção\n> Ação com impacto.')
    expect(warning).toContain('help-callout--warning')
    expect(warning).not.toContain('[!warning]')

    const danger = renderHelpMarkdown('> [!danger] Ação permanente\n> Não pode ser desfeita.')
    expect(danger).toContain('help-callout--danger')
    expect(danger).not.toContain('[!danger]')
  })

  test('citação comum permanece uma citação comum', () => {
    const html = renderHelpMarkdown('> Uma citação sem marcador.')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('help-callout')
    expect(html).toContain('Uma citação sem marcador.')
  })

  test('bloco mermaid permanece como código', () => {
    const html = renderHelpMarkdown('```mermaid\nflowchart LR\n  Login --> Board\n```')
    expect(html).toContain('<pre><code class="language-mermaid">')
    expect(html).toContain('Login --&gt; Board')
  })

  test('HTML cru é escapado e protocolo inseguro não vira link', () => {
    const html = renderHelpMarkdown('<script>alert(1)</script>\n\n[clique](javascript:alert(1))')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('javascript:alert')
    expect(html).toContain('clique')
  })

  test('tabela do manual é renderizada', () => {
    const html = renderHelpMarkdown('| Coluna | Papel |\n|---|---|\n| Board | Execução |')
    expect(html).toContain('<table>')
    expect(html).toContain('Execução')
  })

  test('H1 inicial não é duplicado, mas títulos internos permanecem', () => {
    const html = renderHelpMarkdown('# Conhecer o Board\n\nO Board é o ambiente principal.\n\n## Onde encontrar\n\nPassos.')
    expect(html).not.toContain('<h1')
    expect(html).toContain('<h2>Onde encontrar</h2>')
    expect(html).toContain('O Board é o ambiente principal.')
  })
})

describe('slug interno a partir do href', () => {
  test('reconhece rotas da ajuda e ignora o resto', () => {
    expect(helpSlugFromHref('/help/04-conhecer-o-board')).toBe('04-conhecer-o-board')
    expect(helpSlugFromHref('/help/home#comece')).toBe('home')
    expect(helpSlugFromHref('/projects')).toBeNull()
    expect(helpSlugFromHref('https://exemplo.test/help/x')).toBeNull()
    expect(helpSlugFromHref(null)).toBeNull()
    expect(helpSlugFromHref('/help/')).toBeNull()
  })

  test('considera o base path do deploy', () => {
    expect(helpSlugFromHref('/azyboard/help/04-conhecer-o-board', '/azyboard')).toBe('04-conhecer-o-board')
    expect(helpSlugFromHref('/azyboard/help/04-conhecer-o-board/', '/azyboard/')).toBe('04-conhecer-o-board')
    // Sem o base path esperado, o href de outra área não é tratado como ajuda.
    expect(helpSlugFromHref('/outro/help/x', '/azyboard')).toBeNull()
  })
})

describe('links da ajuda sob base path', () => {
  test('prefixa os links internos quando o app é publicado em subpath', () => {
    const markdown = 'Veja [o glossário](/help/00-glossario).'
    expect(renderHelpMarkdown(markdown)).toContain('href="/help/00-glossario"')
    expect(renderHelpMarkdown(markdown, { basePath: '/azyboard' })).toContain('href="/azyboard/help/00-glossario"')
    expect(renderHelpMarkdown(markdown, { basePath: '/azyboard/' })).toContain('href="/azyboard/help/00-glossario"')
  })

  test('ignora base path inválido em vez de injetar no HTML', () => {
    const markdown = 'Veja [o glossário](/help/00-glossario).'
    expect(renderHelpMarkdown(markdown, { basePath: '/azyboard" onload="alert(1)' })).toContain('href="/help/00-glossario"')
    expect(renderHelpMarkdown(markdown, { basePath: 'azyboard' })).toContain('href="/help/00-glossario"')
  })
})
