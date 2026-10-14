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
let patchFailure: { status: number; error: string } | null
let patchGate: Promise<void> | null
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
    if (method === 'PATCH' && path === '/projects/project-1') {
      if (patchFailure) return jsonResponse({ error: patchFailure.error }, patchFailure.status)
      if (patchGate) await patchGate
      project = { ...project, ...body }
      return jsonResponse(project)
    }
    return jsonResponse({ error: 'não encontrado' }, 404)
  }) as typeof fetch
}

function patchCalls() {
  return calls.filter(call => call.method === 'PATCH')
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  calls.length = 0
  authState.user = { id: 'user-1', globalGroup: 'ADMIN' }
  project = { id: 'project-1', name: 'Projeto Planejado', description: null, startDate: null, plannedEndDate: null, plannedPoints: null, plannedHours: null, scope: null }
  members = [{ userId: 'user-1', role: 'ADMIN' }]
  links = []
  attachments = []
  attachmentsEnabled = false
  patchFailure = null
  patchGate = null
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

/** Abre a modal e espera os campos carregarem. */
async function openModal(props: { onClose?: () => void; onSaved?: (project: unknown) => void } = {}) {
  const view = render(<ProjectPlanningModal projectId="project-1" onClose={props.onClose ?? (() => {})} onSaved={props.onSaved} />)
  await screen.findByLabelText('Nome do projeto')
  return view
}

function saveButton() {
  return screen.getByRole('button', { name: 'Salvar' })
}

type User = ReturnType<typeof userEvent.setup>

// Nota de ambiente: o happy-dom não entrega `user.clear` ao React (só a via de
// teclado chega ao `onChange`), então os campos são esvaziados com backspaces.
async function clearField(user: User, label: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement
  await user.click(input)
  const backspaces = '{backspace}'.repeat(input.value.length)
  if (backspaces) await user.type(input, backspaces)
}

async function typeInto(user: User, label: string, value: string) {
  await clearField(user, label)
  await user.type(screen.getByLabelText(label), value)
}

describe('ProjectPlanningModal (Card T59)', () => {
  test('ADMIN altera um campo, nada é enviado antes do clique e o PATCH leva apenas o campo alterado', async () => {
    await openModal()

    const user = userEvent.setup()
    await typeInto(user, 'Total de Pontos Previsto', '12')
    expect(patchCalls()).toEqual([])

    await user.click(saveButton())

    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(patchCalls()[0]).toMatchObject({ path: '/projects/project-1', body: { plannedPoints: 12 } })
  })

  test('o botão de salvar fica indisponível sem alterações', async () => {
    await openModal()

    expect(saveButton()).toBeDisabled()
    expect(patchCalls()).toEqual([])
  })

  test('o nome do projeto é persistido ao salvar', async () => {
    await openModal()

    const user = userEvent.setup()
    await typeInto(user, 'Nome do projeto', 'Projeto Renomeado')
    await user.click(saveButton())

    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(patchCalls()[0].body).toEqual({ name: 'Projeto Renomeado' })
  })

  test('nome vazio bloqueia a gravação e indica obrigatoriedade', async () => {
    await openModal()

    const user = userEvent.setup()
    await clearField(user, 'Nome do projeto')
    await user.click(saveButton())

    expect(await screen.findByText('O nome do projeto é obrigatório.')).toBeInTheDocument()
    expect(patchCalls()).toEqual([])
  })

  test('cancelar descarta o rascunho e fecha sem gravar', async () => {
    const closed: string[] = []
    await openModal({ onClose: () => { closed.push('cancelar') } })

    const user = userEvent.setup()
    await typeInto(user, 'Total de Pontos Previsto', '12')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(closed).toEqual(['cancelar'])
    expect(patchCalls()).toEqual([])
  })

  test('fechar pela cruz descarta o rascunho sem gravar', async () => {
    const closed: string[] = []
    await openModal({ onClose: () => { closed.push('fechar') } })

    const user = userEvent.setup()
    await typeInto(user, 'Total de Pontos Previsto', '12')
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(closed).toEqual(['fechar'])
    expect(patchCalls()).toEqual([])
  })

  test('falha de gravação aparece no rodapé, preserva o rascunho e libera nova tentativa', async () => {
    patchFailure = { status: 409, error: 'Já existe um projeto com esse nome' }
    await openModal()

    const user = userEvent.setup()
    await typeInto(user, 'Total de Pontos Previsto', '12')
    await user.click(saveButton())

    expect(await screen.findByText('Já existe um projeto com esse nome')).toBeInTheDocument()
    expect((screen.getByLabelText('Total de Pontos Previsto') as HTMLInputElement).value).toBe('12')
    expect(saveButton()).not.toBeDisabled()
  })

  test('reabrir a modal exibe os valores persistidos no servidor', async () => {
    const first = await openModal()
    const user = userEvent.setup()
    await typeInto(user, 'Total de Pontos Previsto', '12')
    await user.click(saveButton())
    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    first.unmount()

    await openModal()
    expect((screen.getByLabelText('Total de Pontos Previsto') as HTMLInputElement).value).toBe('12')
  })

  test('MEMBER/VIEWER veem os campos em modo leitura e sem rodapé de ações', async () => {
    authState.user = { id: 'user-2', globalGroup: 'TEAM_MEMBER' }
    members = [{ userId: 'user-2', role: 'VIEWER' }]
    await openModal()

    const startDate = await screen.findByLabelText('Data de Início')
    expect(startDate).toBeDisabled()
    expect(screen.getByLabelText('Nome do projeto')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
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
    // A área de conteúdo rola dentro da altura fixa e o rodapé de ações fica fora dela.
    const content = dialog.querySelector('.overflow-y-auto')
    expect(content).not.toBeNull()
    expect(content?.contains(saveButton())).toBe(false)

    // Trocar de aba não altera a altura do diálogo.
    links = [{ id: 'l1', itemId: 'item-1', name: 'Wiki', url: 'https://wiki.example.com', description: null, item: { id: 'item-1', title: 'Card A', sequenceCode: 'T1', type: 'TASK' } }]
    await user.click(screen.getByRole('tab', { name: /Todos os links/ }))
    await screen.findByRole('link', { name: /Wiki/ })
    expect(screen.getByRole('dialog').className).toContain('h-[90vh]')
  })

  test('alterar só a descrição envia apenas a descrição no PATCH', async () => {
    await openModal()

    const user = userEvent.setup()
    await typeInto(user, 'Descrição do projeto', 'Resumo do projeto')
    expect(patchCalls()).toEqual([])

    await user.click(saveButton())

    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(patchCalls()[0]).toMatchObject({ path: '/projects/project-1', body: { description: 'Resumo do projeto' } })
  })

  test('a descrição é gravada sem espaços nas pontas', async () => {
    await openModal()

    const user = userEvent.setup()
    await typeInto(user, 'Descrição do projeto', '  Resumo com folga  ')
    await user.click(saveButton())

    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(patchCalls()[0].body).toEqual({ description: 'Resumo com folga' })
  })

  test('o campo de descrição fica abaixo do nome, limita a 20.000 caracteres e desabilita ao salvar', async () => {
    await openModal()

    const description = screen.getByLabelText('Descrição do projeto') as HTMLTextAreaElement
    expect(description.tagName).toBe('TEXTAREA')
    expect(description.getAttribute('maxlength')).toBe('20000')
    // O campo fica imediatamente abaixo do nome e acima das datas e estimativas.
    const html = document.body.innerHTML
    expect(html.indexOf('project-planning-name')).toBeLessThan(html.indexOf('project-planning-description'))
    expect(html.indexOf('project-planning-description')).toBeLessThan(html.indexOf('planning-start-date'))
    // Ajuda de preenchimento aponta o destino do texto (o card do projeto).
    expect(screen.getByText(/card do projeto/i)).toBeInTheDocument()

    let openGate: () => void = () => {}
    patchGate = new Promise<void>(resolve => { openGate = resolve })
    const user = userEvent.setup()
    await typeInto(user, 'Descrição do projeto', 'Resumo')
    await user.click(saveButton())

    await waitFor(() => expect(description).toBeDisabled())
    openGate()
    await waitFor(() => expect(patchCalls()).toHaveLength(1))
  })

  test('descrição vazia grava string vazia e a modal reabre com o campo vazio', async () => {
    project = { ...project, description: 'Resumo antigo' }
    const first = await openModal()

    const user = userEvent.setup()
    await clearField(user, 'Descrição do projeto')
    await user.click(saveButton())

    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(patchCalls()[0].body).toEqual({ description: '' })
    first.unmount()

    await openModal()
    expect((screen.getByLabelText('Descrição do projeto') as HTMLTextAreaElement).value).toBe('')
  })

  test('descrição só com espaços é tratada como remoção do texto', async () => {
    project = { ...project, description: 'Resumo antigo' }
    await openModal()

    const user = userEvent.setup()
    await typeInto(user, 'Descrição do projeto', '   ')
    await user.click(saveButton())

    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(patchCalls()[0].body).toEqual({ description: '' })
  })

  test('cancelar descarta a descrição sem gravar e mantém o valor do servidor', async () => {
    project = { ...project, description: 'Resumo antigo' }
    const closed: string[] = []
    const first = await openModal({ onClose: () => { closed.push('cancelar') } })

    const user = userEvent.setup()
    await typeInto(user, 'Descrição do projeto', 'Resumo novo')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(closed).toEqual(['cancelar'])
    expect(patchCalls()).toEqual([])
    first.unmount()

    await openModal()
    expect((screen.getByLabelText('Descrição do projeto') as HTMLTextAreaElement).value).toBe('Resumo antigo')
  })

  test('fechar pela cruz e ESC descartam a descrição sem gravar', async () => {
    project = { ...project, description: 'Resumo antigo' }

    const byCross: string[] = []
    const crossView = await openModal({ onClose: () => { byCross.push('cruz') } })
    const user = userEvent.setup()
    await typeInto(user, 'Descrição do projeto', 'Resumo novo')
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(byCross).toEqual(['cruz'])
    crossView.unmount()

    const byEscape: string[] = []
    await openModal({ onClose: () => { byEscape.push('esc') } })
    await typeInto(user, 'Descrição do projeto', 'Outro resumo')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(byEscape).toEqual(['esc'])

    expect(patchCalls()).toEqual([])
  })

  test('MEMBER/VIEWER veem a descrição em modo leitura, sem controles de edição', async () => {
    authState.user = { id: 'user-2', globalGroup: 'TEAM_MEMBER' }
    members = [{ userId: 'user-2', role: 'VIEWER' }]
    project = { ...project, description: 'Resumo exibido no card' }
    await openModal()

    expect(screen.getByText('Resumo exibido no card')).toBeInTheDocument()
    expect(screen.queryByLabelText('Descrição do projeto')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Descrição do projeto' })).not.toBeInTheDocument()
  })

  test('descrição vazia aparece com o mesmo traço dos demais campos vazios', async () => {
    authState.user = { id: 'user-2', globalGroup: 'TEAM_MEMBER' }
    members = [{ userId: 'user-2', role: 'VIEWER' }]
    await openModal()

    // Descrição e escopo vazios usam o mesmo traço no modo leitura.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
