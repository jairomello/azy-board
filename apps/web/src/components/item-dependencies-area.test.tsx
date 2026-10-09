import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { ToastProvider } from './Toast'
import type { ItemDependency, ItemDependencyTarget } from '@azy-board/ui-contracts'

interface ApiCall { method: string; path: string; body?: Record<string, unknown> }

const calls: ApiCall[] = []
let storedDependencies: ItemDependency[] = []
let candidates: Array<{ id: string; title: string; type: 'TASK'; sequenceCode: string | null }> = []
const fetchOriginal = globalThis.fetch

function makeTarget(id: string, title: string, sequenceCode: string | null): ItemDependencyTarget {
  return { id, title, type: 'TASK', sequenceCode }
}

function makeDependency(id: string, target: ItemDependencyTarget, dependencyType = 'FS', lagDays = 0): ItemDependency {
  return { id, itemId: 'item-1', dependsOnItemId: target.id, dependencyType: dependencyType as ItemDependency['dependencyType'], lagDays, createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', dependsOn: target }
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
      const target = candidates.find(candidate => candidate.id === body?.dependsOnItemId) ?? makeTarget(String(body?.dependsOnItemId), 'Candidato', null)
      const created = makeDependency(`dep-${storedDependencies.length + 1}`, target, String(body?.dependencyType ?? 'FS'), Number(body?.lagDays ?? 0))
      storedDependencies = [...storedDependencies, created]
      return jsonResponse(created, 201)
    }
    if (method === 'PATCH') {
      const linkId = path.split('/').pop()!
      const current = storedDependencies.find(dependency => dependency.id === linkId)!
      const updated = { ...current, dependencyType: body?.dependencyType ?? current.dependencyType, lagDays: Number(body?.lagDays ?? current.lagDays) } as ItemDependency
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
    { id: 'item-2', title: 'Card dependido', type: 'TASK', sequenceCode: 'T2' },
    { id: 'item-1', title: 'Este card', type: 'TASK', sequenceCode: 'T1' },
    { id: 'item-cycle', title: 'Ciclo', type: 'TASK', sequenceCode: 'T9' },
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

  test('lista item dependido com tipo, retardo e código', async () => {
    storedDependencies = [makeDependency('dep-1', makeTarget('item-2', 'Card dependido', 'T2'), 'SS', 2)]
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)

    expect(await screen.findByText(/Card dependido/)).toBeInTheDocument()
    expect(screen.getByText(/T2/)).toBeInTheDocument()
    expect(screen.getByText(/Lag 2d/)).toBeInTheDocument()
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
    // O próprio item e os já vinculados ficam fora do seletor.
    const target = screen.getByLabelText('Item dependido') as HTMLSelectElement
    expect(Array.from(target.options).map(option => option.value)).not.toContain('item-1')
    await user.selectOptions(target, 'item-2')
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
    await user.selectOptions(screen.getByLabelText('Item dependido'), 'item-cycle')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText('Essa dependência criaria um ciclo (direto ou indireto) e foi rejeitada.')).toBeInTheDocument())
    expect(screen.getByText('Nenhuma dependência cadastrada neste item.')).toBeInTheDocument()
  })

  test('edita tipo e retardo de dependência existente', async () => {
    storedDependencies = [makeDependency('dep-1', makeTarget('item-2', 'Card dependido', 'T2'))]
    const user = userEvent.setup()
    render(<ItemDependenciesArea itemId="item-1" projectId="project-1" canEdit />)

    await user.click(await screen.findByRole('button', { name: 'Editar dependência' }))
    await user.selectOptions(screen.getByLabelText('Tipo'), 'SF')
    const lag = screen.getByLabelText('Retardo (dias)') as HTMLInputElement
    await user.clear(lag)
    await user.type(lag, '-1')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(screen.getByText(/Lag -1d/)).toBeInTheDocument())
    expect(calls.find(call => call.method === 'PATCH')).toMatchObject({
      path: '/projects/project-1/items/item-1/dependencies/dep-1',
      body: { dependencyType: 'SF', lagDays: -1 },
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