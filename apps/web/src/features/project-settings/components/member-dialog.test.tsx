import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../../i18n'
import { MemberDialog } from './MemberDialog'
import type { MemberCandidate } from '../model/types'

const candidates: MemberCandidate[] = [
  { id: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', avatarUrl: null, globalGroup: 'TEAM_MEMBER', isMember: false },
  { id: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', avatarUrl: null, globalGroup: 'MANAGER', isMember: true },
]

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'add' as const,
    member: null,
    squads: [],
    candidates,
    candidatesLoading: false,
    candidatesError: null,
    onCancel: () => {},
    onAdd: async () => {},
    onEdit: async () => {},
    ...overrides,
  }
}

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('MemberDialog — membro escolhido entre os usuários do tenant', () => {
  test('não expõe campo de e-mail livre', () => {
    render(<MemberDialog {...baseProps()} />)

    expect(screen.getByRole('dialog', { name: 'Adicionar membro' })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por nome ou e-mail')).toBeInTheDocument()
    expect(document.querySelector('input[type="email"]')).toBeNull()
  })

  test('busca filtra por nome ou e-mail', async () => {
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps()} />)

    expect(screen.getByRole('button', { name: /Ana Souza/ })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'bruno')
    expect(screen.queryByRole('button', { name: /Ana Souza/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bruno Lima/ })).toBeInTheDocument()
  })

  test('usuário já membro aparece sinalizado e não é selecionável', async () => {
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps()} />)

    const alreadyMember = screen.getByRole('button', { name: /Bruno Lima/ })
    expect(alreadyMember).toBeDisabled()
    expect(within(alreadyMember).getByText('Já é membro')).toBeInTheDocument()

    await user.click(alreadyMember)
    expect(alreadyMember).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })

  test('confirma enviando o usuário escolhido, o papel e o squad', async () => {
    const added: Array<{ userId: string; role: string; squadId: string }> = []
    const user = userEvent.setup()
    render(<MemberDialog {...baseProps({
      squads: [{ id: 's1', name: 'Squad Alfa', memberCount: 0 }],
      onAdd: async (form: { userId: string; role: string; squadId: string }) => { added.push(form) },
    })} />)

    const confirm = screen.getByRole('button', { name: 'Confirmar' })
    expect(confirm).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Ana Souza/ }))
    await user.selectOptions(screen.getByLabelText('Papel no projeto'), 'VIEWER')
    await user.selectOptions(screen.getByLabelText('Squads'), 's1')
    await user.click(confirm)

    expect(added).toEqual([{ userId: 'u1', role: 'VIEWER', squadId: 's1' }])
  })

  test('falha ao carregar candidatos mantém a confirmação desabilitada', () => {
    render(<MemberDialog {...baseProps({ candidates: [], candidatesError: new Error('falha de rede') })} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários.')
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })

  test('sem candidato selecionável informa e não permite confirmar', () => {
    render(<MemberDialog {...baseProps({ candidates: candidates.filter(item => item.isMember) })} />)

    expect(screen.getByText('Nenhum usuário disponível para adicionar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bruno Lima/ })).toBeDisabled()
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
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(edited).toEqual([{ role: 'VIEWER', squadId: 's1' }])
  })
})
