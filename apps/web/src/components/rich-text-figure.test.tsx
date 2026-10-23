import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { configure, fireEvent, render, waitFor } from '@testing-library/react'

// Esperas mais folgadas: a suíte roda em paralelo e o CI tem carga variável.
configure({ asyncUtilTimeout: 5000 })
import { Editor } from '@tiptap/react'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

const { createRichTextExtensions, RichTextEditorImpl } = await import('./RichTextEditorImpl')
const { htmlToMarkdown, toEditorHtml } = await import('../lib/richText')

const CONTEXTO = { projectId: 'p', itemId: 'i', canEdit: true }

const PNG_ID = '8f2c1e4a-1111-4222-8333-444455556666'
const SVG_ID = '9a3d2f5b-2222-4333-8444-555566667777'
const SUMIU_ID = '7b1c0d9e-3333-4444-8555-666677778888'
const NOVO_ID = '6c2b1a0f-4444-4555-8666-777788889999'

function urlDe(id: string) {
  return `/api/projects/p/items/i/attachments/${id}/download`
}

function anexo(id: string, nome: string, mimeType: string) {
  return { id, filename: nome, originalName: nome, mimeType, size: 1024, createdAt: '2026-10-01T00:00:00.000Z', url: urlDe(id), isImage: true }
}

const ANEXOS = [anexo(PNG_ID, 'grafico.png', 'image/png'), anexo(SVG_ID, 'planta.svg', 'image/svg+xml')]

const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let uploads: string[] = []

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  uploads = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
      uploads.push(url)
      return jsonResponse(anexo(NOVO_ID, 'captura.png', 'image/png'), 201)
    }
    if (url.includes('/attachments')) return jsonResponse(ANEXOS)
    return jsonResponse({}, 404)
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

function editorCom(conteudo: string) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return new Editor({ element: el, extensions: createRichTextExtensions({ placeholder: 'escreva...' }), content: toEditorHtml(conteudo) })
}

function renderEditor(props: { content: string; onChange?: (md: string) => void; attachmentContext?: typeof CONTEXTO }) {
  return render(
    <RichTextEditorImpl
      content={props.content}
      onChange={props.onChange ?? (() => {})}
      attachmentContext={props.attachmentContext}
    />,
  )
}

const PROSEMIRROR = () => waitFor(() => {
  const el = document.querySelector('.ProseMirror')
  expect(el).not.toBeNull()
  return el as HTMLElement
})

describe('editor preserva figura ao editar (Card T87)', () => {
  test('editar outro trecho mantém a figura na posição', () => {
    const editor = editorCom(`Antes\n\n![um](${urlDe(PNG_ID)})\n\nDepois`)
    editor.commands.insertContentAt(0, 'Novo trecho. ')
    const markdown = htmlToMarkdown(editor.getHTML())
    expect(markdown).toContain('Novo trecho.')
    expect(markdown).toContain(`![um](${urlDe(PNG_ID)})`)
    expect(markdown.indexOf('Novo trecho.')).toBeLessThan(markdown.indexOf('![um]'))
    expect(markdown).toContain('Depois')
    editor.destroy()
  })

  test('várias figuras entre parágrafos permanecem', () => {
    const editor = editorCom(`Um\n\n![a](${urlDe(PNG_ID)})\n\nDois\n\n![b](${urlDe(SVG_ID)})\n\nTrês`)
    editor.commands.insertContentAt(0, 'Início. ')
    const markdown = htmlToMarkdown(editor.getHTML())
    expect(markdown.match(/!\[/g)?.length).toBe(2)
    expect(markdown).toContain(`![a](${urlDe(PNG_ID)})`)
    expect(markdown).toContain(`![b](${urlDe(SVG_ID)})`)
    editor.destroy()
  })

  test('imagem base64 não entra no documento', () => {
    const editor = editorCom('')
    editor.commands.setContent('<img src="data:image/png;base64,AAAA" alt="x">')
    expect(editor.getHTML()).not.toContain('data:image')
    editor.destroy()
  })
})

describe('inserir figura na descrição (Card T87)', () => {
  test('oferece a ação quando há contexto de anexos e permissão', async () => {
    renderEditor({ content: 'texto', attachmentContext: CONTEXTO })
    expect(await screen.findByLabelText('Inserir figura')).toBeInTheDocument()
  })

  test('não oferece a ação sem contexto de anexos', async () => {
    renderEditor({ content: 'texto' })
    await PROSEMIRROR()
    expect(screen.queryByLabelText('Inserir figura')).not.toBeInTheDocument()
  })

  test('não oferece a ação a quem não pode enviar anexos', async () => {
    renderEditor({ content: 'texto', attachmentContext: { ...CONTEXTO, canEdit: false } })
    await PROSEMIRROR()
    expect(screen.queryByLabelText('Inserir figura')).not.toBeInTheDocument()
  })

  test('insere a figura escolhida dos anexos do card', async () => {
    let markdown = ''
    renderEditor({ content: 'Antes', onChange: md => { markdown = md }, attachmentContext: CONTEXTO })
    fireEvent.click(await screen.findByLabelText('Inserir figura'))
    fireEvent.click(await screen.findByLabelText('Usar a imagem grafico.png'))
    await waitFor(() => expect(markdown).toContain(`![grafico.png](${urlDe(PNG_ID)})`))
  })

  test('colar imagem sobe o arquivo e insere a figura', async () => {
    let markdown = ''
    renderEditor({ content: 'Antes', onChange: md => { markdown = md }, attachmentContext: CONTEXTO })
    const dom = await PROSEMIRROR()
    fireEvent.paste(dom, { clipboardData: { files: [new File(['x'], 'colada.png', { type: 'image/png' })] } })
    await waitFor(() => expect(uploads.length).toBe(1))
    await waitFor(() => expect(markdown).toContain(`![captura.png](${urlDe(NOVO_ID)})`))
    expect(markdown).not.toContain('data:')
  })

  test('colar sem permissão não insere nada', async () => {
    renderEditor({ content: 'Antes', attachmentContext: { ...CONTEXTO, canEdit: false } })
    const dom = await PROSEMIRROR()
    fireEvent.paste(dom, { clipboardData: { files: [new File(['x'], 'colada.png', { type: 'image/png' })] } })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(uploads.length).toBe(0)
    expect(dom.textContent).toContain('Antes')
    expect(document.body.textContent).not.toContain('captura.png')
  })
})

describe('figura citada na descrição (Card T87)', () => {
  test('anexo de imagem vira imagem acionável com nome acessível', async () => {
    renderEditor({ content: `Antes\n\n![grafico](${urlDe(PNG_ID)})\n\nDepois`, attachmentContext: CONTEXTO })
    const botao = await screen.findByLabelText('Ampliar imagem grafico.png')
    const imagem = botao.querySelector('img')
    expect(imagem).not.toBeNull()
    // Miniatura pequena: largura da coluna com teto de altura (10rem) e proporção.
    expect(imagem!.className).toContain('max-h-40')
    expect(imagem!.className).toContain('object-contain')
  })

  test('formato sem exibição inline vira cartão de arquivo', async () => {
    renderEditor({ content: `Antes\n\n![planta](${urlDe(SVG_ID)})\n\nDepois`, attachmentContext: CONTEXTO })
    expect(await screen.findByText(/planta\.svg — formato sem visualização no texto/)).toBeInTheDocument()
    expect(document.querySelector('[data-figure="arquivo"] img')).toBeNull()
  })

  test('anexo citado que não existe mais mostra imagem indisponível', async () => {
    renderEditor({ content: `Antes\n\n![sumiu](${urlDe(SUMIU_ID)})\n\nDepois`, attachmentContext: CONTEXTO })
    expect(await screen.findByText(/Imagem indisponível: sumiu/)).toBeInTheDocument()
  })

  test('ESC no lightbox não chega ao handler da modal do card', async () => {
    renderEditor({ content: `![grafico](${urlDe(PNG_ID)})`, attachmentContext: CONTEXTO })
    fireEvent.click(await screen.findByLabelText('Ampliar imagem grafico.png'))
    await waitFor(() => expect(document.querySelector('.yarl__root')).not.toBeNull())

    // Simula o listener de ESC da modal do card (window, fase de bolha).
    let chegouNaModal = false
    const ouvir = (evento: KeyboardEvent) => { if (evento.key === 'Escape') chegouNaModal = true }
    window.addEventListener('keydown', ouvir)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    window.removeEventListener('keydown', ouvir)

    expect(chegouNaModal).toBe(false)
    await waitFor(() => expect(document.querySelector('.yarl__root')).toBeNull())
  })

  test('clicar na figura abre o lightbox das imagens do card', async () => {
    renderEditor({ content: `![grafico](${urlDe(PNG_ID)})`, attachmentContext: CONTEXTO })
    fireEvent.click(await screen.findByLabelText('Ampliar imagem grafico.png'))
    await waitFor(() => expect(document.querySelector('.yarl__root')).not.toBeNull())
  })
})
