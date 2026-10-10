import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { ToastProvider } from './Toast'
import type { ItemDependency, ItemDependencyTarget } from '@azy-board/ui-contracts'

interface ApiCall { method: string; path: string; body?: Record<string, unknown> }

const calls: ApiCall[] = []
let storedDependencies: ItemDependency[] = []
let candidates: Array<{ id: string; title: string; type: 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'EXTERNAL'; sequenceCode: string | null; parentId: string | null }> = []
const fetchOriginal = globalThis.fetch

function makeTarget(id: string, title: string, sequenceCode: string | null): ItemDependencyTarget {
  return { id, title, type: 'TASK', sequenceCode, projectId: 'proj-1', projectName: null }
}

function makeDependency(id: string, target: ItemDependencyTarget, dependencyType = 'FS', lagDays = 0): ItemDependency {
  return { id, itemId: 'item-1', dependsOnItemId: target.id, dependsOnProjectId: null, dependencyType: dependencyType as ItemDependency['dependencyType'], lagDays, createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', dependsOn: target }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^\/api/, '')
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
    calls.push({ method, path, ...(body ? { body } : {}) })
    const isDependencies = path.endsWith('/dependencies')

    if (method === 'GET') return isDependencies ? jsonResponse(structuredClone(storedDependencies)) : jsonResponse({ data: structuredClone(candidates), page: 1, limit: 50, total: candidates.length, hasMore: false, nextCursor: null })
    if (method === 'POST') {
      if (body?.dependsOnItemId === 'item-cycle') {
        return jsonResponse({ error: { code: 'DEPENDENCY_CYCLE', message: 'Essa dependência criaria um ciclo (direto ou indireto) e foi rejeitada.', details: null, retryable: false } }, 409)
      }
      const foundCandidate = candidates.find(candidate => candidate.id === body?.dependsOnItemId)
      const target = foundCandidate ? makeTarget(foundCandidate.id, foundCandidate.title, foundCandidate.sequenceCode) : makeTarget(String(body?.dependsOnItemId), 'Candidato', null)
      const created = makeDependency(`dep-${storedDependencies.length + 1}`, target, String(body?.dependencyType ?? 'FS'), Number(body?.lagDays ?? 0))
      storedDependencies = [...storedDependencies, created]
      return jsonResponse(created, 201)
    }
    if (method === 'PATCH') {
      const linkId = path.split('/').pop()!
      const current = storedDependencies.find(dependency => dependency.id === linkId)!
      const nextDependsOnId = body?.dependsOnItemId !== undefined ? String(body?.dependsOnItemId) : current.dependsOnItemId
      const found = candidates.find(candidate => candidate.id === nextDependsOnId)
      const dependsOn = found ? makeTarget(found.id, found.title, found.sequenceCode) : current.dependsOn
      const updated = {
        ...current,
        dependsOnItemId: nextDependsOnId,
        dependsOn,
        dependencyType: body?.dependencyType ?? current.dependencyType,
        lagDays: Number(body?.lagDays ?? current.lagDays),
      } as ItemDependency
      storedDependencies = storedDependencies.map(dependency => (dependency.id === linkId ? updated : dependency))
      return jsonResponse(updated)
    }
    if (method === 'DELETE') {
      const linkId = path.split('/').pop()!
      storedDependencies = storedDependencies.filter(dependency => dependency.id !== linkId)
      return jsonResponse({ ok: true })
    }
    return jsonResponse({ error: 'Método não suportado' }, 405)
  }) as typeof fetch
}

const { ItemDependenciesArea } = await import('./ItemDependenciesArea')

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  calls.length = 0
  storedDependencies = []
  candidates = [
    { id: 'item-2', title: 'Card dependido', type: 'TASK', sequenceCode: 'T2', parentId: null },
    { id: 'item-1', title: 'Este card', type: 'TASK', sequenceCode: 'T1', parentId: null },
    { id: 'item-nocode', title: 'Legado', type: 'TASK', sequenceCode: null, parentId: null },
    { id: 'item-cycle', title: 'Ciclo', type: 'TASK', sequenceCode: 'T9', parentId: null },
  ]
  installFetchStub()
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

describe('ItemDependenciesArea', () => {
  test('carrega e exibe o estado vazio quando o item não tem dependências', async () => {
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)

    await waitFor(() => expect(screen.getByText('Nenhuma dependência cadastrada neste item.')).toBeInTheDocument())
    expect(calls.some(call => call.method === 'GET' && call.path === '/projects/project-1/items/item-1/dependencies')).toBe(true)
  })

  test('lista item dependido com identificador destacado, título e retardo', async () => {
    storedDependencies = [makeDependency('dep-1', makeTarget('item-2', 'Card dependido', 'T2'), 'SS', 2)]
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)

    expect(await screen.findByText(/Card dependido/)).toBeInTheDocument()
    expect(screen.getByText(/T2/)).toBeInTheDocument()
    expect(screen.getByText(/Lag 2d/)).toBeInTheDocument()
  })

  test('não mostra UUID nem tipo como identificador quando falta código sequencial', async () => {
    storedDependencies = [makeDependency('dep-legacy', makeTarget('item-nocode', 'Legado', null))]
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)

    await screen.findByText('Legado')
    expect(screen.queryByText('#item-noc')).not.toBeInTheDocument()
    expect(screen.getByText('Legado')).toBeInTheDocument()
    expect(screen.queryByText('Tarefa')).not.toBeInTheDocument()
  })

  test('leitura não expõe controles de criação, edição ou remoção', async () => {
    storedDependencies = [makeDependency('dep-1', makeTarget('item-2', 'Card dependido', 'T2'))]
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit={false} />)

    await screen.findByText(/Card dependido/)
    expect(screen.getByText(/Card dependido/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar dependência' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar dependência' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover dependência' })).not.toBeInTheDocument()
  })

  test('cria dependência escolhendo item, tipo e retardo', async () => {
    const user = userEvent.setup()
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)
    await waitFor(() => expect(screen.getByText('Nenhuma dependência cadastrada neste item.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Adicionar dependência' }))
    // O próprio item fica fora do seletor (busca integrada no combo).
    const combo = screen.getByLabelText('Item dependido') as HTMLInputElement
    await user.click(combo)
    const optionTexts = screen.getAllByRole('option').map((option: HTMLElement) => option.textContent ?? '')
    expect(optionTexts.some((text: string) => /Este card/.test(text))).toBe(false)
    // Opções exibem o código sequencial com o título quando há código.
    expect(optionTexts.some((text: string) => text === 'T2 — Card dependido')).toBe(true)
    // Para itens legados sem código, não inventa UUID nem tipo como identificação.
    expect(optionTexts.some((text: string) => text === 'Legado')).toBe(true)
    await user.type(combo, 'T2')
    await user.click(await screen.findByRole('option', { name: 'T2 — Card dependido' }))
    await user.selectOptions(screen.getByLabelText('Tipo'), 'SS')
    const lag = screen.getByLabelText('Retardo (dias)') as HTMLInputElement
    await user.clear(lag)
    await user.type(lag, '3')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText(/Card dependido/)).toBeInTheDocument())
    expect(calls.find(call => call.method === 'POST')).toMatchObject({
      path: '/projects/project-1/items/item-1/dependencies',
      body: { dependsOnItemId: 'item-2', dependencyType: 'SS', lagDays: 3 },
    })
  })

  test('exibe erro do servidor ao tentar criar dependência circular', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit /></ToastProvider>)
    await waitFor(() => expect(screen.getByText('Nenhuma dependência cadastrada neste item.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Adicionar dependência' }))
    const combo = screen.getByLabelText('Item dependido') as HTMLInputElement
    await user.click(combo)
    await user.type(combo, 'T9')
    await user.click(await screen.findByRole('option', { name: 'T9 — Ciclo' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('Essa dependência criaria um ciclo (direto ou indireto) e foi rejeitada.')).toBeInTheDocument())
    expect(screen.getByText('Nenhuma dependência cadastrada neste item.')).toBeInTheDocument()
  })

  test('seletor de item dependido exibe a hierarquia com indentação', async () => {
    candidates = [
      { id: 'ep', title: 'Épico', type: 'EPIC', sequenceCode: 'E1', parentId: null },
      { id: 'st', title: 'Story', type: 'STORY', sequenceCode: 'S1', parentId: 'ep' },
      { id: 'tk1', title: 'Tarefa 1', type: 'TASK', sequenceCode: 'T1', parentId: 'st' },
      { id: 'tk2', title: 'Tarefa 2', type: 'TASK', sequenceCode: 'T2', parentId: 'st' },
    ]
    const user = userEvent.setup()
    render(<ItemDependenciesArea itemId="card-atual" projectId="project-1" canEdit />)
    await waitFor(() => expect(screen.getByText('Nenhuma dependência cadastrada neste item.')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Adicionar dependência' }))

    const combo = screen.getByLabelText('Item dependido') as HTMLInputElement
    await user.click(combo)
    const listbox = screen.getByRole('listbox')
    const texts = within(listbox).getAllByRole('option').map((option: HTMLElement) => option.textContent ?? '')
    // Pai antes do filho, com caracteres de árvore e indentação por nível.
    expect(texts[0]).toBe('E1 — Épico')
    expect(texts[1]).toBe('└─ S1 — Story')
    expect(texts[2]).toBe('    ├─ T1 — Tarefa 1')
    expect(texts[3]).toBe('    └─ T2 — Tarefa 2')

    // Busca integrada filtra a lista hierárquica.
    await user.type(combo, 'Tarefa 1')
    expect(within(listbox).getAllByRole('option')).toHaveLength(1)
    expect(within(listbox).getByRole('option', { name: /Tarefa 1/ })).toBeInTheDocument()
  })

  test('edita dependência com o mesmo formulário, pré-preenchido e troca de alvo', async () => {
    storedDependencies = [makeDependency('dep-1', makeTarget('item-2', 'Card dependido', 'T2'))]
    const user = userEvent.setup()
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: 'Editar dependência' }))
    // Formulário igual ao de inclusão: campo do item dependido visível e pré-preenchido.
    const combo = screen.getByLabelText('Item dependido') as HTMLInputElement
    expect(combo).toHaveValue('T2 — Card dependido')
    // Troca de alvo na edição.
    await user.click(combo)
    await user.clear(combo)
    await user.type(combo, 'T9')
    await user.click(await screen.findByRole('option', { name: 'T9 — Ciclo' }))
    await user.selectOptions(screen.getByLabelText('Tipo'), 'SF')
    const lag = screen.getByLabelText('Retardo (dias)') as HTMLInputElement
    await user.clear(lag)
    await user.type(lag, '-1')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText(/Lag -1d/)).toBeInTheDocument())
    expect(calls.find(call => call.method === 'PATCH')).toMatchObject({
      path: '/projects/project-1/items/item-1/dependencies/dep-1',
      body: { dependsOnItemId: 'item-cycle', dependencyType: 'SF', lagDays: -1 },
    })
  })

  test('remove dependência após confirmação', async () => {
    storedDependencies = [makeDependency('dep-1', makeTarget('item-2', 'Card dependido', 'T2'))]
    const confirmOriginal = globalThis.confirm
    globalThis.confirm = () => true
    const user = userEvent.setup()
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: 'Remover dependência' }))

    await waitFor(() => expect(screen.getByText('Nenhuma dependência cadastrada neste item.')).toBeInTheDocument())
    expect(calls.find(call => call.method === 'DELETE')).toMatchObject({ path: '/projects/project-1/items/item-1/dependencies/dep-1' })
    globalThis.confirm = confirmOriginal
  })
})
