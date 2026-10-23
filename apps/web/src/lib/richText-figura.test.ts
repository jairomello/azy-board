import { describe, expect, test } from 'bun:test'
import { attachmentIdFromUrl, citedAttachmentIds, hasFigureCitation, htmlToMarkdown, toEditorHtml } from './richText'

// Card T87 — a figura do texto é um anexo do card citado em Markdown padrão; o
// que garante que ela sobreviva a editar é a ida e volta Markdown ↔ HTML.
const ID = '8f2c1e4a-1111-4222-8333-444455556666'
const URL_FIG = `/api/projects/p/items/i/attachments/${ID}/download`

describe('figura na descrição — ida e volta Markdown (Card T87)', () => {
  test('imagem do Markdown vira <img> na carga do editor', () => {
    const html = toEditorHtml(`Antes\n\n![diagrama](${URL_FIG})\n\nDepois`)
    expect(html).toContain('<img')
    expect(html).toContain(`src="${URL_FIG}"`)
    expect(html).toContain('alt="diagrama"')
  })

  test('<img> do editor volta para Markdown de imagem', () => {
    expect(htmlToMarkdown(`<img src="${URL_FIG}" alt="diagrama">`)).toBe(`![diagrama](${URL_FIG})`)
  })

  test('ida e volta preserva várias figuras e o texto ao redor', () => {
    const voltou = htmlToMarkdown(toEditorHtml(`Antes\n\n![um](${URL_FIG})\n\nMeio\n\n![dois](${URL_FIG})\n\nDepois`))
    expect(voltou.match(/!\[/g)?.length).toBe(2)
    for (const trecho of ['Antes', 'Meio', 'Depois', URL_FIG]) expect(voltou).toContain(trecho)
  })

  test('figuras vizinhas voltam como blocos separados', () => {
    const voltou = htmlToMarkdown(`<img src="${URL_FIG}" alt="a"><img src="${URL_FIG}" alt="b">`)
    expect(voltou).toContain(`![a](${URL_FIG})`)
    expect(voltou).toContain(`![b](${URL_FIG})`)
    // Uma linha em branco entre elas: sem isso o texto reabre com as figuras coladas.
    expect(/!\[a\]\([^)]+\)\n\n!\[b\]\([^)]+\)/.test(voltou)).toBe(true)
  })

  test('figura dentro de parágrafo com texto segue inline', () => {
    expect(htmlToMarkdown('<p>veja <img src="https://exemplo.test/a.png" alt="x"> aqui</p>')).toBe('veja ![x](https://exemplo.test/a.png) aqui')
  })

  test('imagem com data: é recusada em vez de virar <img>', () => {
    expect(toEditorHtml('![x](data:image/png;base64,AAAA)')).not.toContain('<img')
  })

  test('imagem externa por http continua suportada', () => {
    expect(toEditorHtml('![x](https://exemplo.test/a.png)')).toContain('src="https://exemplo.test/a.png"')
  })
})

describe('citações de anexo na descrição (Card T87)', () => {
  test('extrai o id do anexo citado', () => {
    expect(attachmentIdFromUrl(URL_FIG)).toBe(ID)
    expect(citedAttachmentIds(`![diagrama](${URL_FIG})`)).toEqual([ID])
  })

  test('deduplica a mesma citação e ignora imagem externa', () => {
    const markdown = `![a](${URL_FIG})\n\n![b](${URL_FIG})\n\n![c](https://exemplo.test/x.png)`
    expect(citedAttachmentIds(markdown)).toEqual([ID])
  })

  test('hasFigureCitation distingue texto sem figura', () => {
    expect(hasFigureCitation('Descrição sem figura alguma')).toBe(false)
    expect(hasFigureCitation(`![diagrama](${URL_FIG})`)).toBe(true)
  })

  test('citação com título continua sendo reconhecida', () => {
    expect(citedAttachmentIds(`![diagrama](${URL_FIG} "título")`)).toEqual([ID])
  })
})
