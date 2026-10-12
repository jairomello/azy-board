import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

interface ApiCall { method: string; path: string; body?: Record<string, unknown> }

const authState: { user: { id: string; globalGroup: string } } = { user: { id: 'user-1', globalGroup: 'ADMIN' } }
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }))

const { ProjectPlanningModal } = await import('./ProjectPlanningModal')

const calls: ApiCall[] = []
let project: Record<string, unknown>
let members: Array<{ userId: string; role: string }>
let links: unknown[]
let attachments: unknown[]
let attachmentsEnabled: boolean
const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^\/api/, '').split('?')[0]
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    calls.push({ method, path, ...(body ? { body } : {}) })

    if (method === 'GET' && path === '/projects/project-1') return jsonResponse(project)
    if (method === 'GET' && path === '/projects/project-1/members') return jsonResponse(members)
    if (method === 'GET' && path === '/tenant/attachments/enabled') return jsonResponse({ enabled: attachmentsEnabled })
    if (method === 'GET' && path === '/projects/project-1/links') return jsonResponse(links)
    if (method === 'GET' && path === '/projects/project-1/attachments') return jsonResponse(attachments)
    if (method === 'PATCH' && path === '/projects/project-1') return jsonResponse({ ...project, ...body })
    return jsonResponse({ error: 'não encontrado' }, 404)
  }) as typeof fetch
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  calls.length = 0
  authState.user = { id: 'user-1', globalGroup: 'ADMIN' }
  project = { id: 'project-1', name: 'Projeto Planejado', startDate: null, plannedEndDate: null, plannedPoints: null, plannedHours: null, scope: null }
  members = [{ userId: 'user-1', role: 'ADMIN' }]
  links = []
  attachments = []
  attachmentsEnabled = false
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('ProjectPlanningModal (Card T59)', () => {
  test('ADMIN edita um campo de planejamento e persiste via PATCH', async () => {
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    const startDate = await screen.findByLabelText('Data de Início')
    fireEvent.change(startDate, { target: { value: '2026-03-01' } })
    fireEvent.blur(startDate)

    await waitFor(() => expect(calls.find(call => call.method === 'PATCH')).toMatchObject({ body: { startDate: '2026-03-01' } }))
    expect(calls.find(call => call.method === 'PATCH')?.path).toBe('/projects/project-1')
  })

  test('MEMBER/VIEWER veem os campos em modo leitura', async () => {
    authState.user = { id: 'user-2', globalGroup: 'TEAM_MEMBER' }
    members = [{ userId: 'user-2', role: 'VIEWER' }]
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    const startDate = await screen.findByLabelText('Data de Início')
    expect(startDate).toBeDisabled()
    const name = screen.getByLabelText('Nome do projeto')
    expect(name).toBeDisabled()
  })

  test('aba "Todos os links" lista os links do projeto com origem e sem controles de edição', async () => {
    links = [{ id: 'l1', itemId: 'item-1', name: 'Wiki do projeto', url: 'https://wiki.example.com', description: null, item: { id: 'item-1', title: 'Card A', sequenceCode: 'T1', type: 'TASK' } }]
    const user = userEvent.setup()
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    await user.click(await screen.findByRole('tab', { name: /Todos os links/ }))
    const anchor = await screen.findByRole('link', { name: /Wiki do projeto/ })
    expect(anchor).toHaveAttribute('href', 'https://wiki.example.com')
    expect(anchor).toHaveAttribute('target', '_blank')
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.body.textContent).toContain('Card A')
    expect(screen.queryByRole('button', { name: 'Adicionar link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover link' })).not.toBeInTheDocument()
  })

  test('aba "Todos os links" mostra estado vazio quando o projeto não tem links', async () => {
    const user = userEvent.setup()
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    await user.click(await screen.findByRole('tab', { name: /Todos os links/ }))
    await screen.findByText('Nenhum link neste projeto.')
  })

  test('aba "Todos os anexos" lista anexos com origem e download quando habilitados', async () => {
    attachmentsEnabled = true
    attachments = [{ id: 'a1', itemId: 'item-1', originalName: 'relatorio.pdf', label: 'Relatório', mimeType: 'application/pdf', size: 10, createdAt: '2026-10-01T00:00:00.000Z', url: '/api/projects/project-1/items/item-1/attachments/a1/download', isImage: false, item: { id: 'item-1', title: 'Card A', sequenceCode: 'T1', type: 'TASK' } }]
    const user = userEvent.setup()
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    await user.click(await screen.findByRole('tab', { name: /Todos os anexos/ }))
    const anchor = await screen.findByRole('link', { name: /Relatório/ })
    expect(anchor.getAttribute('href')).toContain('/items/item-1/attachments/a1/download')
    expect(document.body.textContent).toContain('Card A')
  })

  test('aba "Todos os anexos" fica oculta quando anexos estão desabilitados', async () => {
    attachmentsEnabled = false
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    await screen.findByLabelText('Data de Início')
    await waitFor(() => expect(calls.some(call => call.path === '/tenant/attachments/enabled')).toBe(true))
    expect(screen.queryByRole('tab', { name: /Todos os anexos/ })).not.toBeInTheDocument()
  })

  test('aba "Todos os anexos" mostra miniatura e abre o lightbox do projeto', async () => {
    attachmentsEnabled = true
    attachments = [
      { id: 'a1', itemId: 'item-1', originalName: 'Foto.png', label: 'Foto', mimeType: 'image/png', size: 10, createdAt: '2026-10-01T00:00:00.000Z', url: '/api/projects/project-1/items/item-1/attachments/a1/download', isImage: true, item: { id: 'item-1', title: 'Card A', sequenceCode: 'T1', type: 'TASK' } },
      { id: 'a2', itemId: 'item-1', originalName: 'doc.pdf', label: 'Doc', mimeType: 'application/pdf', size: 10, createdAt: '2026-10-01T00:00:00.000Z', url: '/api/projects/project-1/items/item-1/attachments/a2/download', isImage: false, item: { id: 'item-1', title: 'Card A', sequenceCode: 'T1', type: 'TASK' } },
    ]
    const user = userEvent.setup()
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    await user.click(await screen.findByRole('tab', { name: /Todos os anexos/ }))
    const openButton = await screen.findByRole('button', { name: 'Abrir imagem Foto' })
    // Origem "T1 · Card A" aparece para cada anexo do projeto.
    expect(screen.getAllByText(/Card A/).length).toBe(2)
    // PDF não vira miniatura acionável.
    expect(screen.queryByRole('button', { name: 'Abrir imagem Doc' })).not.toBeInTheDocument()

    await user.click(openButton)
    await waitFor(() => expect(document.querySelector('[class*="yarl__"]')).not.toBeNull())
  })

  test('mantém altura fixa independente da aba ativa', async () => {
    const user = userEvent.setup()
    render(<ProjectPlanningModal projectId="project-1" onClose={() => {}} />)

    const dialog = await screen.findByRole('dialog')
    expect(dialog.className).toContain('h-[90vh]')
    expect(dialog.className).not.toContain('max-h-[90vh]')
    // A área de conteúdo rola dentro da altura fixa.
    const content = dialog.querySelector('.overflow-y-auto')
    expect(content).not.toBeNull()

    // Trocar de aba não altera a altura do diálogo.
    links = [{ id: 'l1', itemId: 'item-1', name: 'Wiki', url: 'https://wiki.example.com', description: null, item: { id: 'item-1', title: 'Card A', sequenceCode: 'T1', type: 'TASK' } }]
    await user.click(screen.getByRole('tab', { name: /Todos os links/ }))
    await screen.findByRole('link', { name: /Wiki/ })
    expect(screen.getByRole('dialog').className).toContain('h-[90vh]')
  })
})
