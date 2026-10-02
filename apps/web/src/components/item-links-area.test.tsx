import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import type { ItemLink } from '@azy-board/ui-contracts'

interface ApiCall { method: string; path: string; body?: Record<string, unknown> }

const calls: ApiCall[] = []
let storedLinks: ItemLink[] = []
const fetchOriginal = globalThis.fetch

function makeLink(id: string, name: string, url: string, description: string | null = null): ItemLink {
  return { id, name, url, description, createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z' }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Stub de rede no nível do fetch: exercita o cliente HTTP real (lib/api)
// sem depender de mock de módulo do bun:test.
function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^\/api/, '')
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    calls.push({ method, path, ...(body ? { body } : {}) })
    const linkId = path.split('/').pop()!

    if (method === 'GET') return jsonResponse(structuredClone(storedLinks))
    if (method === 'POST') {
      const created = makeLink(`link-${storedLinks.length + 1}`, String(body?.name), String(body?.url), (body?.description as string | null) ?? null)
      storedLinks = [...storedLinks, created]
      return jsonResponse(created, 201)
    }
    if (method === 'PATCH') {
      const updated = { ...storedLinks.find(link => link.id === linkId)!, ...body, description: (body?.description as string | null | undefined) ?? null } as ItemLink
      storedLinks = storedLinks.map(link => (link.id === linkId ? updated : link))
      return jsonResponse(updated)
    }
    if (method === 'DELETE') {
      storedLinks = storedLinks.filter(link => link.id !== linkId)
      return jsonResponse({ ok: true })
    }
    return jsonResponse({ error: 'Método não suportado' }, 405)
  }) as typeof fetch
}

const { ItemLinksArea } = await import('./ItemLinksArea')

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  calls.length = 0
  storedLinks = []
  installFetchStub()
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

describe('ItemLinksArea', () => {
  test('carrega e exibe o estado vazio quando o item não tem links', async () => {
    render(<ItemLinksArea itemId="item-1" projectId="project-1" canEdit />)

    await waitFor(() => expect(screen.getByText('Nenhum link neste item.')).toBeInTheDocument())
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/projects/project-1/items/item-1/links' })
  })

  test('lista nome, URL e descrição e abre o link em nova guia com proteção', async () => {
    storedLinks = [makeLink('link-1', 'Wiki do projeto', 'https://wiki.example.com/t11', 'Documentação **externa**')]
    render(<ItemLinksArea itemId="item-1" projectId="project-1" canEdit={false} />)

    const anchor = await screen.findByRole('link', { name: /Wiki do projeto/ })
    expect(anchor).toHaveAttribute('href', 'https://wiki.example.com/t11')
    expect(anchor).toHaveAttribute('target', '_blank')
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('https://wiki.example.com/t11')).toBeInTheDocument()
    expect(document.body.textContent).toContain('Documentação')
  })

  test('leitura não expõe controles de criação, edição ou remoção', async () => {
    storedLinks = [makeLink('link-1', 'Drive', 'https://drive.example.com/doc')]
    render(<ItemLinksArea itemId="item-1" projectId="project-1" canEdit={false} />)

    await screen.findByRole('link', { name: /Drive/ })
    expect(screen.queryByRole('button', { name: 'Adicionar link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover link' })).not.toBeInTheDocument()
  })

  test('cria link pelo formulário quando o usuário pode editar', async () => {
    const user = userEvent.setup()
    render(<ItemLinksArea itemId="item-1" projectId="project-1" canEdit />)
    await waitFor(() => expect(screen.getByText('Nenhum link neste item.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Adicionar link' }))
    await user.type(screen.getByLabelText('Nome'), 'Especificação')
    await user.type(screen.getByLabelText('Endereço do link'), 'https://sharepoint.example.com/spec')
    await user.type(screen.getByLabelText('Descrição (Markdown)'), 'Spec do T11')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByRole('link', { name: /Especificação/ })).toBeInTheDocument())
    expect(calls.find(call => call.method === 'POST')).toMatchObject({
      path: '/projects/project-1/items/item-1/links',
      body: { name: 'Especificação', url: 'https://sharepoint.example.com/spec', description: 'Spec do T11' },
    })
  })

  test('edita link existente enviando patch com os campos do formulário', async () => {
    storedLinks = [makeLink('link-1', 'Confluence', 'https://confluence.example.com/page')]
    const user = userEvent.setup()
    render(<ItemLinksArea itemId="item-1" projectId="project-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: 'Editar link' }))
    const nameInput = screen.getByLabelText('Nome')
    await user.clear(nameInput)
    await user.type(nameInput, 'Confluence atualizado')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByRole('link', { name: /Confluence atualizado/ })).toBeInTheDocument())
    expect(calls.find(call => call.method === 'PATCH')).toMatchObject({
      path: '/projects/project-1/items/item-1/links/link-1',
      body: { name: 'Confluence atualizado', url: 'https://confluence.example.com/page', description: '' },
    })
  })

  test('remove link após confirmação', async () => {
    storedLinks = [makeLink('link-1', 'Drive', 'https://drive.example.com/doc')]
    const confirmOriginal = globalThis.confirm
    globalThis.confirm = () => true
    const user = userEvent.setup()
    render(<ItemLinksArea itemId="item-1" projectId="project-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: 'Remover link' }))

    await waitFor(() => expect(screen.getByText('Nenhum link neste item.')).toBeInTheDocument())
    expect(calls.find(call => call.method === 'DELETE')).toMatchObject({ path: '/projects/project-1/items/item-1/links/link-1' })
    globalThis.confirm = confirmOriginal
  })
})
