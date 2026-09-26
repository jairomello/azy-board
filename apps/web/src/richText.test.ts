import { describe, expect, test } from 'bun:test'
import { htmlToMarkdown, isHtmlContent, markdownToHtml, toCanonicalMarkdown, toEditorHtml, toMarkdown } from './lib/richText'

describe('isHtmlContent', () => {
  test('reconhece HTML legado do editor', () => {
    expect(isHtmlContent('<p><strong>Tipo:</strong> bug</p>')).toBe(true)
    expect(isHtmlContent('  <h1>Título</h1>')).toBe(true)
    expect(isHtmlContent('<ul><li>a</li></ul>')).toBe(true)
    expect(isHtmlContent('<!-- comentário --><p>x</p>')).toBe(true)
  })

  test('não confunde Markdown com HTML', () => {
    expect(isHtmlContent('**Tipo:** bug de contrato')).toBe(false)
    expect(isHtmlContent('<https://example.com> autolink')).toBe(false)
    expect(isHtmlContent('texto comum')).toBe(false)
    expect(isHtmlContent('')).toBe(false)
  })
})

describe('markdownToHtml', () => {
  test('renderiza a formatação usada pela IA', () => {
    const html = markdownToHtml('**Tipo:** bug com `código`')
    expect(html).toContain('<strong>Tipo:</strong>')
    expect(html).toContain('<code>código</code>')
    expect(html).not.toContain('**')
  })

  test('renderiza títulos, listas e citação', () => {
    const html = markdownToHtml('# Título\n\n- item\n\n> citação')
    expect(html).toContain('<h1>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<blockquote>')
  })

  test('escapa HTML cru embutido no Markdown (conteúdo vem de IA)', () => {
    const html = markdownToHtml('a <script>alert(1)</script> b <img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<img src=x onerror')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('alert(1)')
  })

  test('bloqueia javascript: em links e imagens', () => {
    expect(markdownToHtml('[link](javascript:alert(1))')).not.toContain('href="javascript')
    expect(markdownToHtml('![img](javascript:alert(1))')).not.toContain('src="javascript')
    expect(markdownToHtml('[ok](https://example.com)')).toContain('href="https://example.com"')
  })
})

describe('htmlToMarkdown', () => {
  test('converte o HTML do TipTap para Markdown canônico', () => {
    expect(htmlToMarkdown('<p><strong>Tipo:</strong> bug com <code>código</code></p>')).toBe('**Tipo:** bug com `código`')
  })

  test('descarta atributos perigosos de HTML legado', () => {
    expect(htmlToMarkdown('<p onclick="x()">ok</p>')).toBe('ok')
  })

  test('vazio vira string vazia', () => {
    expect(htmlToMarkdown('')).toBe('')
    expect(htmlToMarkdown('<p></p>')).toBe('')
  })
})

describe('toMarkdown', () => {
  test('Markdown canônico passa adiante', () => {
    expect(toMarkdown('**Tipo:** bug')).toBe('**Tipo:** bug')
  })

  test('HTML legado vira Markdown equivalente', () => {
    expect(toMarkdown('<p><strong>Tipo:</strong> bug</p>')).toBe('**Tipo:** bug')
  })

  test('vazio permanece vazio', () => {
    expect(toMarkdown('')).toBe('')
    expect(toMarkdown('   ')).toBe('')
  })
})

describe('toEditorHtml', () => {
  test('Markdown vira HTML formatado (correção do bug de exibição crua)', () => {
    const html = toEditorHtml('**Tipo:** bug de contrato')
    expect(html).toContain('<strong>Tipo:</strong>')
    expect(html).not.toContain('**')
  })

  test('HTML legado vira HTML equivalente, sem atributos perigosos', () => {
    const html = toEditorHtml('<p onclick="x()"><em>l</em> <strong>b</strong></p>')
    expect(html).toContain('<em>l</em>')
    expect(html).toContain('<strong>b</strong>')
    expect(html).not.toContain('onclick')
  })

  test('vazio permanece vazio', () => {
    expect(toEditorHtml('')).toBe('')
    expect(toEditorHtml('   ')).toBe('')
  })
})

describe('toCanonicalMarkdown', () => {
  test('normaliza Markdown e HTML legado para a mesma forma canônica', () => {
    const fromMarkdown = toCanonicalMarkdown('**Tipo:** bug')
    const fromHtml = toCanonicalMarkdown('<p><strong>Tipo:</strong> bug</p>')
    expect(fromMarkdown).toBe('**Tipo:** bug')
    expect(fromHtml).toBe(fromMarkdown)
  })

  test('é idempotente (md → html → md é ponto fixo)', () => {
    const md = '**Tipo:** bug\n\n1. passo um\n2. passo dois\n\n`código`'
    const once = toCanonicalMarkdown(md)
    expect(toCanonicalMarkdown(once)).toBe(once)
    expect(toCanonicalMarkdown(toEditorHtml(once))).toBe(once)
  })
})
