import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module

const authState = { avatarCalls: [] as Blob[], removeCalls: 0 }

mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Admin Um', email: 'admin@test.local', globalGroup: 'ADMIN', language: 'pt-BR', theme: 'light', lightShellTheme: 'petroleum', avatarUrl: null },
    showHiddenProjects: false,
    updateAvatar: async (blob: Blob) => { authState.avatarCalls.push(blob) },
    removeAvatar: async () => { authState.removeCalls += 1 },
  }),
}))
mockModule('../contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('../hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))
// O recorte em canvas não é o alvo destes testes: o editor é substituído por um botão que confirma.
mockModule('../components/AvatarCropDialog', () => ({
  AvatarCropDialog: (props: { open: boolean; onConfirm: (blob: Blob) => void; onCancel: () => void }) => props.open
    ? (
        <div>
          <button type="button" onClick={() => props.onConfirm(new Blob(['recorte'], { type: 'image/webp' }))}>aplicar-recorte</button>
          <button type="button" onClick={props.onCancel}>cancelar-recorte</button>
        </div>
      )
    : null,
}))

const { default: AdminUsersPage } = await import('./AdminUsersPage')

const managedUsers = [
  { id: 'admin-1', name: 'Admin Um', email: 'admin@test.local', globalGroup: 'ADMIN', avatarUrl: null },
  { id: 'user-2', name: 'Pessoa Dois', email: 'pessoa2@test.local', globalGroup: 'TEAM_MEMBER', avatarUrl: null },
  { id: 'user-3', name: 'Pessoa Três', email: 'pessoa3@test.local', globalGroup: 'TEAM_MEMBER', avatarUrl: '/api/users/user-3/avatar?v=abc' },
]

const requests: Array<{ method: string; path: string }> = []
const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(/^\/api/, '').split('?')[0]!
    const method = (init?.method ?? 'GET').toUpperCase()
    requests.push({ method, path })
    if (method === 'GET' && path === '/users') {
      return jsonResponse({ data: managedUsers, page: 1, limit: 25, total: managedUsers.length, hasMore: false })
    }
    if (method === 'PUT' && path === '/users/user-2/avatar') {
      return jsonResponse({ user: { ...managedUsers[1], avatarUrl: '/api/users/user-2/avatar?v=novo' } })
    }
    if (method === 'DELETE' && path === '/users/user-3/avatar') {
      return jsonResponse({ user: { ...managedUsers[2], avatarUrl: null } })
    }
    return jsonResponse({}, 404)
  }) as typeof fetch
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openPhotoDialog(userName: string) {
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: `Foto de ${userName}` })
  await user.click(trigger)
  return { user, trigger, dialog: screen.getByRole('dialog', { name: `Foto de ${userName}` }) }
}

function chooseImage(name = 'foto.png', type = 'image/png') {
  const input = screen.getByLabelText('Escolher arquivo de imagem')
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type })] } })
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  authState.avatarCalls = []
  authState.removeCalls = 0
  requests.length = 0
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('AdminUsersPage — gestão da foto de perfil', () => {
  test('miniatura mostra a foto quando existe e as iniciais quando não existe', async () => {
    renderPage()
    await screen.findByText('Pessoa Dois')

    const semFoto = screen.getByRole('button', { name: 'Foto de Pessoa Dois' })
    expect(within(semFoto).getByText('PD')).toBeInTheDocument()

    const comFoto = screen.getByRole('button', { name: 'Foto de Pessoa Três' })
    expect(within(comFoto).getByRole('img', { name: 'Pessoa Três' })).toHaveAttribute('src', '/api/users/user-3/avatar?v=abc')
  })

  test('Admin inclui a foto de outro usuário pelo editor de recorte', async () => {
    renderPage()
    await screen.findByText('Pessoa Dois')
    const { user, dialog } = await openPhotoDialog('Pessoa Dois')

    expect(within(dialog).getByRole('button', { name: 'Incluir foto' })).toBeInTheDocument()
    chooseImage()

    await user.click(await screen.findByRole('button', { name: 'aplicar-recorte' }))

    await waitFor(() => expect(requests.some(request => request.method === 'PUT' && request.path === '/users/user-2/avatar')).toBe(true))
    expect(await screen.findByText('Foto de Pessoa Dois atualizada.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Foto de Pessoa Dois' })).toBeNull()
    expect(authState.avatarCalls).toHaveLength(0)
  })

  test('Admin remove a foto somente após a confirmação', async () => {
    renderPage()
    await screen.findByText('Pessoa Três')
    const { user, dialog } = await openPhotoDialog('Pessoa Três')

    await user.click(within(dialog).getByRole('button', { name: 'Remover foto' }))
    expect(within(dialog).getByText(/Remover a foto de Pessoa Três/)).toBeInTheDocument()
    expect(requests.some(request => request.method === 'DELETE' && request.path === '/users/user-3/avatar')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar remoção' }))

    await waitFor(() => expect(requests.some(request => request.method === 'DELETE' && request.path === '/users/user-3/avatar')).toBe(true))
    expect(await screen.findByText('Foto de Pessoa Três removida.')).toBeInTheDocument()
  })

  test('na própria linha delega ao autoatendimento e não chama a rota administrativa', async () => {
    renderPage()
    await screen.findByText('Admin Um')
    const { user } = await openPhotoDialog('Admin Um')

    chooseImage()
    await user.click(await screen.findByRole('button', { name: 'aplicar-recorte' }))

    await waitFor(() => expect(authState.avatarCalls).toHaveLength(1))
    expect(requests.some(request => request.method === 'PUT' && request.path === '/users/admin-1/avatar')).toBe(false)
    expect(await screen.findByText('Foto de Admin Um atualizada.')).toBeInTheDocument()
  })

  test('arquivo inválido é recusado sem abrir o recorte', async () => {
    renderPage()
    await screen.findByText('Pessoa Dois')
    const { dialog } = await openPhotoDialog('Pessoa Dois')

    chooseImage('nota.txt', 'text/plain')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Selecione um arquivo de imagem válido.')
    expect(screen.queryByRole('button', { name: 'aplicar-recorte' })).toBeNull()
  })

  test('Escape fecha o diálogo e devolve o foco à miniatura', async () => {
    renderPage()
    await screen.findByText('Pessoa Dois')
    const { trigger } = await openPhotoDialog('Pessoa Dois')

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Foto de Pessoa Dois' })).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
})
