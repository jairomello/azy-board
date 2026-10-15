import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Leitora', email: 'leitora@test.local', globalGroup: 'TEAM_MEMBER', language: 'pt-BR', theme: 'light', lightShellTheme: 'petroleum' },
  }),
}))
mockModule('../contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('../hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))

const { default: HelpPage } = await import('./HelpPage')

const fetchOriginal = globalThis.fetch
const t = (key: string) => i18n.t(key, { ns: 'common' })

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const index = {
  version: 'v1',
  home: { slug: 'home', title: 'Azy Board', order: 0, path: 'Home.md' },
  modules: [
    {
      id: '00', title: 'Início', order: 0,
      pages: [{ slug: 'home', title: 'Azy Board', order: 0, path: 'Home.md' }, { slug: '00-glossario', title: 'Glossário', order: 3, path: '00 - Inicio/Glossario.md' }],
    },
    {
      id: '04', title: 'Board e Visualizações', order: 4,
      pages: [{ slug: '04-conhecer-o-board', title: 'Conhecer o Board', order: 1, path: '04 - Board e Visualizacoes/Conhecer o Board.md' }],
    },
  ],
}

const pages: Record<string, { title: string; markdown: string }> = {
  home: { title: 'Azy Board', markdown: '# Azy Board\n\nManual do produto.' },
  '00-glossario': { title: 'Glossário', markdown: '# Glossário\n\nTermos do produto.' },
  '04-conhecer-o-board': { title: 'Conhecer o Board', markdown: '# Conhecer o Board\n\nO Board é o ambiente operacional.' },
}

function installFetchStub(options: { failPage?: string } = {}) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input).replace(/^\/api/, '').split('?')[0] ?? ''
    if (path === '/help/index') return jsonResponse(index)
    const match = /^\/help\/pages\/(.+)$/.exec(path)
    if (match) {
      const slug = decodeURIComponent(match[1]!)
      if (options.failPage === slug) return jsonResponse({ error: { code: 'HELP_UNAVAILABLE', message: 'indisponível', retryable: true, details: null } }, 500)
      const page = pages[slug]
      if (!page) return jsonResponse({ error: { code: 'HELP_PAGE_NOT_FOUND', message: 'não encontrada', retryable: false, details: null } }, 404)
      return jsonResponse({ version: 'v1', slug, order: 0, path: `pages/${slug}.md`, moduleId: null, moduleTitle: 'Board e Visualizações', sha256: 'a'.repeat(64), markdown: page.markdown, title: page.title })
    }
    return jsonResponse({}, 404)
  }) as typeof fetch
}

function renderHelp(initialPath = '/help') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/help" element={<HelpPage />} />
        <Route path="/help/:slug" element={<HelpPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { installFetchStub() })
afterEach(() => { globalThis.fetch = fetchOriginal })

describe('central de ajuda', () => {
  test('mostra o índice de tópicos e abre a página inicial', async () => {
    renderHelp()
    await waitFor(() => expect(screen.getByText('Board e Visualizações')).toBeInTheDocument())
    expect(screen.getByRole('navigation', { name: t('help.topics') })).toBeInTheDocument()
    expect(screen.getByText('Glossário')).toBeInTheDocument()
    expect(screen.getByText('Conhecer o Board')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Azy Board' })).toBeInTheDocument())
    expect(screen.getByText('Manual do produto.')).toBeInTheDocument()
    // O título aparece uma única vez (o H1 do documento não é repetido).
    expect(screen.getAllByRole('heading', { name: 'Azy Board' })).toHaveLength(1)
  })

  test('abre outra página pelo índice de tópicos', async () => {
    renderHelp()
    await waitFor(() => expect(screen.getByText('Conhecer o Board')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Conhecer o Board' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Conhecer o Board' })).toBeInTheDocument())
    expect(screen.getByText('O Board é o ambiente operacional.')).toBeInTheDocument()
  })

  test('abre diretamente a rota de uma página', async () => {
    renderHelp('/help/00-glossario')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Glossário' })).toBeInTheDocument())
    expect(screen.getByText('Termos do produto.')).toBeInTheDocument()
  })

  test('navega por link interno da página sem recarregar a aplicação', async () => {
    installFetchStub()
    const linkMarkdown = '# Azy Board\n\nVeja [o glossário](/help/00-glossario).'
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const path = String(input).replace(/^\/api/, '').split('?')[0] ?? ''
      if (path === '/help/index') return jsonResponse(index)
      if (path === '/help/pages/home') return jsonResponse({ version: 'v1', slug: 'home', order: 0, path: 'Home.md', moduleId: null, moduleTitle: 'Início', sha256: 'a'.repeat(64), markdown: linkMarkdown, title: 'Azy Board' })
      if (path === '/help/pages/00-glossario') return jsonResponse({ version: 'v1', slug: '00-glossario', order: 3, path: '00 - Inicio/Glossario.md', moduleId: '00', moduleTitle: 'Início', sha256: 'b'.repeat(64), markdown: '# Glossário\n\nTermos do produto.', title: 'Glossário' })
      return original(input as RequestInfo)
    }) as typeof fetch

    renderHelp()
    const link = await screen.findByRole('link', { name: 'o glossário' })
    expect(link).toHaveAttribute('href', '/help/00-glossario')
    await userEvent.click(link)
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Glossário' })).toBeInTheDocument())
  })

  test('erro ao carregar a página mantém o índice navegável e permite tentar de novo', async () => {
    installFetchStub({ failPage: '04-conhecer-o-board' })
    renderHelp('/help/04-conhecer-o-board')
    await waitFor(() => expect(screen.getByText(t('help.error'))).toBeInTheDocument())
    expect(screen.getByRole('button', { name: t('help.retry') })).toBeInTheDocument()
    // O índice continua disponível para navegar.
    expect(screen.getByText('Glossário')).toBeInTheDocument()

    installFetchStub()
    await userEvent.click(screen.getByRole('button', { name: t('help.retry') }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Conhecer o Board' })).toBeInTheDocument())
  })
})
