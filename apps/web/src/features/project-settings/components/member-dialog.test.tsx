import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../../../i18n'
import type { MemberBatchResult, MemberCandidate } from '../model/types'

// A grade busca no servidor pelo hook `useMemberCandidates`; aqui ele é substituído por um
// estado controlado, o que deixa o teste focado na seleção, nos defaults e no resumo.
const hookState: {
  candidates: MemberCandidate[]
  loading: boolean
  error: unknown
  hasMore: boolean
  loadMoreCalls: number
  terms: Array<{ term: string; enabled: boolean }>
} = { candidates: [], loading: false, error: null, hasMore: false, loadMoreCalls: 0, terms: [] }

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../hooks/useMemberCandidates', () => ({
  useMemberCandidates: (_projectId: string | undefined, term: string, enabled: boolean) => {
    hookState.terms.push({ term, enabled })
    return {
      candidates: hookState.candidates,
      total: hookState.candidates.length,
      loading: hookState.loading,
      loadingMore: false,
      error: hookState.error,
      hasMore: hookState.hasMore,
      loadMore: async () => { hookState.loadMoreCalls += 1 },
    }
  },
}))

const { MemberDialog } = await import('./MemberDialog')

const ana: MemberCandidate = { id: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', avatarUrl: null, globalGroup: 'TEAM_MEMBER', isMember: false }
const bruno: MemberCandidate = { id: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', avatarUrl: null, globalGroup: 'TEAM_MEMBER', isMember: false }
const created = (ids: string[]): MemberBatchResult => ({ ok: true, created: ids, skipped: [], invalid: [] })

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'add' as const,
    member: null,
    projectId: 'p-1',
    squads: [],
    onCancel: () => {},
    onAddMembers: async (members: Array<{ userId: string }>) => created(members.map(entry => entry.userId)),
    onEdit: async () => {},
    ...overrides,
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  hookState.candidates = [ana, bruno]
  hookState.loading = false
  hookState.error = null
  hookState.hasMore = false
  hookState.loadMoreCalls = 0
  hookState.terms = []
})

describe('MemberDialog — grade de adição em lote', () => {
  test('lista as pessoas em colunas com checkbox e sem campo de e-mail livre', () => {
    render(<MemberDialog {...baseProps()} />)

    expect(screen.getByRole('dialog', { name: 'Adicionar membro' })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por nome ou e-mail')).toBeInTheDocument()
    for (const header of ['Nome', 'E-mail', 'Squad', 'Papel']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Selecionar Ana Souza')).toBeInTheDocument()
    expect(screen.getByLabelText('Selecionar Bruno Lima')).toBeInTheDocument()
    expect(document.querySelector('input[type="email"]')).toBeNull()
  })

  test('confirmação fica desabilitada sem nenhuma linha marcada', async () => {
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps()} />)

    const confirm = screen.getByRole('button', { name: 'Confirmar' })
    expect(confirm).toBeDisabled()

    await user.click(screen.getByLabelText('Selecionar Ana Souza'))
    expect(screen.getByText('1 selecionado(s)')).toBeInTheDocument()
    expect(confirm).toBeEnabled()
  })

  test('múltiplas linhas marcadas geram um único envio com papel e squad de cada linha', async () => {
    const batches: Array<Array<{ userId: string; role: string; squadId: string | null }>> = []
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps({
      squads: [{ id: 's1', name: 'Squad Alfa', memberCount: 0 }],
      onAddMembers: async (members: Array<{ userId: string; role: string; squadId: string | null }>) => {
        batches.push(members)
        return created(members.map(entry => entry.userId))
      },
    })} />)

    await user.click(screen.getByLabelText('Selecionar Ana Souza'))
    await user.click(screen.getByLabelText('Selecionar Bruno Lima'))
    await user.selectOptions(screen.getByLabelText('Papel de Bruno Lima'), 'VIEWER')
    await user.selectOptions(screen.getByLabelText('Squad de Ana Souza'), 's1')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    // Um único POST com as duas pessoas, cada uma com seu papel/squad.
    expect(batches).toEqual([[
      { userId: 'u1', role: 'MEMBER', squadId: 's1' },
      { userId: 'u2', role: 'VIEWER', squadId: 's1' },
    ]])
  })

  test('um squad no projeto já vem pré-selecionado e sem squad fica nulo', async () => {
    const batches: Array<Array<{ userId: string; squadId: string | null }>> = []
    const user = userEvent.setup()
    const { unmount } = render(<MemberDialog {...baseProps({
      squads: [{ id: 's1', name: 'Squad Alfa', memberCount: 0 }],
      onAddMembers: async (members: Array<{ userId: string; squadId: string | null }>) => {
        batches.push(members)
        return created(members.map(entry => entry.userId))
      },
    })} />)

    await user.click(screen.getByLabelText('Selecionar Ana Souza'))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(batches).toEqual([[{ userId: 'u1', role: 'MEMBER', squadId: 's1' }]])
    unmount()

    // Sem squad cadastrado, o envio vai sem squad.
    render(<MemberDialog {...baseProps({
      onAddMembers: async (members: Array<{ userId: string; squadId: string | null }>) => {
        batches.push(members)
        return created(members.map(entry => entry.userId))
      },
    })} />)
    await user.click(screen.getByLabelText('Selecionar Bruno Lima'))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(batches[1]).toEqual([{ userId: 'u2', role: 'MEMBER', squadId: null }])
  })

  test('com mais de um squad a linha começa sem squad e o usuário escolhe', async () => {
    const batches: Array<Array<{ userId: string; squadId: string | null }>> = []
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps({
      squads: [{ id: 's1', name: 'Squad Alfa', memberCount: 0 }, { id: 's2', name: 'Squad Beta', memberCount: 0 }],
      onAddMembers: async (members: Array<{ userId: string; squadId: string | null }>) => {
        batches.push(members)
        return created(members.map(entry => entry.userId))
      },
    })} />)

    const squadSelect = screen.getByLabelText('Squad de Ana Souza') as HTMLSelectElement
    expect(squadSelect.value).toBe('')

    await user.click(screen.getByLabelText('Selecionar Ana Souza'))
    await user.selectOptions(squadSelect, 's2')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(batches).toEqual([[{ userId: 'u1', role: 'MEMBER', squadId: 's2' }]])
  })

  test('filtro é aplicado com debounce antes de virar consulta', async () => {
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps()} />)

    hookState.terms = []
    await user.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'bru')
    // Nada foi consultado ainda: o termo só chega ao hook depois do debounce.
    expect(hookState.terms.every(entry => entry.term === '')).toBe(true)

    await waitFor(() => expect(hookState.terms.some(entry => entry.term === 'bru')).toBe(true), { timeout: 2_000 })
  })

  test('trocar o filtro e carregar mais preservam as marcações e o contador', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<MemberDialog {...baseProps()} />)

    await user.click(screen.getByLabelText('Selecionar Ana Souza'))
    expect(screen.getByText('1 selecionado(s)')).toBeInTheDocument()

    // Filtro novo traz outra página: a marcação anterior continua contada e marcada.
    hookState.candidates = [bruno]
    rerender(<MemberDialog {...baseProps()} />)
    expect(screen.queryByLabelText('Selecionar Ana Souza')).not.toBeInTheDocument()
    expect(screen.getByText('1 selecionado(s)')).toBeInTheDocument()

    // Carregar mais traz a primeira página de volta: Ana segue marcada.
    hookState.candidates = [ana, bruno]
    hookState.hasMore = true
    rerender(<MemberDialog {...baseProps()} />)
    expect(screen.getByLabelText('Selecionar Ana Souza')).toBeChecked()
    expect(screen.getByLabelText('Selecionar Bruno Lima')).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(hookState.loadMoreCalls).toBe(1)
  })

  test('fecha o dialog quando todas as entradas foram criadas', async () => {
    let cancelled = 0
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps({ onCancel: () => { cancelled += 1 } })} />)

    await user.click(screen.getByLabelText('Selecionar Ana Souza'))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(cancelled).toBe(1))
  })

  test('mantém o dialog aberto com o resumo quando há entradas inválidas', async () => {
    let cancelled = 0
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps({
      onCancel: () => { cancelled += 1 },
      onAddMembers: async (members: Array<{ userId: string }>) => ({
        ok: true,
        created: members.slice(0, 1).map(entry => entry.userId),
        skipped: [{ userId: 'u2', reason: 'ALREADY_MEMBER' as const }],
        invalid: [{ userId: 'u3', reason: 'SQUAD_NOT_IN_PROJECT' as const }],
      }),
    })} />)

    await user.click(screen.getByLabelText('Selecionar Ana Souza'))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('1 membro(s) adicionado(s)')
    expect(status).toHaveTextContent('1 já era(m) membro(s)')
    expect(status).toHaveTextContent('1 não pôde(ram) ser adicionado(s)')
    expect(screen.getByRole('dialog', { name: 'Adicionar membro' })).toBeInTheDocument()
    expect(cancelled).toBe(0)
  })

  test('falha ao carregar candidatos mostra erro e desabilita a confirmação', () => {
    hookState.error = new Error('falha de rede')
    hookState.candidates = []
    render(<MemberDialog {...baseProps()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários.')
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })

  test('sem candidato disponível informa e não permite confirmar', () => {
    hookState.candidates = []
    render(<MemberDialog {...baseProps()} />)

    expect(screen.getByText('Nenhum usuário disponível para adicionar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })

  test('modo de edição mantém papel e squad do membro atual', async () => {
    const edited: Array<{ role: string; squadId: string }> = []
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps({
      mode: 'edit' as const,
      member: { userId: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', role: 'VIEWER', squadId: 's1' },
      squads: [{ id: 's1', name: 'Squad Alfa', memberCount: 1 }],
      onEdit: async (_member: unknown, role: string, squadId: string) => { edited.push({ role, squadId }) },
    })} />)

    expect(screen.getByRole('dialog', { name: 'Editar membro' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar por nome ou e-mail')).not.toBeInTheDocument()
    expect((screen.getByLabelText('Papel no projeto') as HTMLSelectElement).value).toBe('VIEWER')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(edited).toEqual([{ role: 'VIEWER', squadId: 's1' }])
    expect(within(screen.getByRole('dialog')).queryByLabelText('Selecionar Ana Souza')).not.toBeInTheDocument()
  })
})
