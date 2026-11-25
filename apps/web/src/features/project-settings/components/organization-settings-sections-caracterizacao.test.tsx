import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../../../i18n'
import type { Column, CostCenter, Member, Squad } from '../model/types'

// Teste de caracterização (P0 — rede de segurança do redesenho de Configurações).
// Colunas, Membros & Squads e Centros de Custo, no nível do componente e com as
// seções abertas: a ação principal de cada seção chama o handler esperado e os
// controles só-admin (A8-05) somem para quem não administra o projeto.

// A grade de candidatos do dialog busca no servidor; aqui só importa que ela abre.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../hooks/useMemberCandidates', () => ({
  useMemberCandidates: () => ({ candidates: [], total: 0, loading: false, loadingMore: false, error: null, hasMore: false, loadMore: async () => {} }),
}))

const { OrganizationSettingsSections } = await import('./OrganizationSettingsSections')

const colunas: Column[] = [
  { id: 'c-fazer', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
  { id: 'c-fazendo', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1, progressWeight: 50, progressWeightOverride: null },
  { id: 'c-feito', name: 'Feito', baseStatus: 'DONE', position: 2, progressWeight: 100, progressWeightOverride: null },
]
const squads: Squad[] = [{ id: 's1', name: 'Squad Alfa', memberCount: 1 }]
const membros: Member[] = [
  { userId: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', role: 'ADMIN', squadId: 's1', squadName: 'Squad Alfa' },
  { userId: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', role: 'MEMBER', squadId: null, squadName: null },
]
const centros: CostCenter[] = [{ id: 'cc1', code: 'CC-001', description: 'Operação', sortOrder: 0 }]

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'p-1',
    columns: colunas, members: membros, squads, costCenters: centros, manager: null,
    isAdmin: true, currentUserId: 'u1',
    openSections: new Set(['columns', 'members-squads', 'cost-centers']), onToggleSection: () => {},
    onCreateColumn: async () => {}, onRenameColumn: async () => {}, onDeleteColumn: async () => {},
    onUpdateColumnWeight: async () => {}, onUpdateColumnStatus: async () => {},
    onCreateSquad: async () => {}, onRenameSquad: async () => {}, onDeleteSquad: async () => {},
    onAddMembers: async () => ({ ok: true, created: [], skipped: [], invalid: [] }), onEditMember: async () => {}, onRemoveMember: async () => {},
    onCreateCostCenter: async () => {}, onEditCostCenter: async () => {}, onDeleteCostCenter: async () => {},
    ...overrides,
  }
}

const regiao = (nome: string) => screen.getByRole('region', { name: nome })
// Linhas da lista: o contêiner mais próximo que tem o nome do registro e os botões de ação.
const linhaDe = (secao: HTMLElement, texto: string) => within(secao).getByText(texto).closest('div.flex.items-center.justify-between') as HTMLElement
const botoesSemNome = (linha: HTMLElement) => within(linha).getAllByRole('button').filter(botao => !botao.textContent?.trim())

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('OrganizationSettingsSections — colunas', () => {
  test('lista as colunas e cria uma nova com nome e status base', async () => {
    const criadas: Array<[string, string]> = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({ onCreateColumn: async (nome: string, status: string) => { criadas.push([nome, status]) } })} />)

    const secao = regiao('Colunas')
    for (const nome of ['A Fazer', 'Fazendo', 'Feito']) expect(within(secao).getByText(nome)).toBeInTheDocument()
    await user.type(within(secao).getByPlaceholderText('Nome da coluna'), 'Revisão')
    const selects = within(secao).getAllByRole('combobox').filter(select => !select.getAttribute('aria-label'))
    await user.selectOptions(selects[0]!, 'IN_PROGRESS')
    await user.click(within(secao).getByRole('button', { name: 'Nova coluna' }))
    expect(criadas).toEqual([['Revisão', 'IN_PROGRESS']])
  })

  test('trocar o status base de uma coluna chama a atualização', async () => {
    const trocas: Array<[string, string]> = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({ onUpdateColumnStatus: async (id: string, status: string) => { trocas.push([id, status]) } })} />)

    const statusDaColuna = within(regiao('Colunas')).getAllByRole('combobox', { name: 'Status base da coluna' })
    expect(statusDaColuna).toHaveLength(3)
    await user.selectOptions(statusDaColuna[1]!, 'BLOCKED')
    expect(trocas).toEqual([['c-fazendo', 'BLOCKED']])
  })

  test('excluir coluna pede confirmação com coluna de destino', async () => {
    const exclusoes: Array<[string, string]> = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({ onDeleteColumn: async (coluna: Column, destino: string) => { exclusoes.push([coluna.id, destino]) } })} />)

    const [, lixeira] = botoesSemNome(linhaDe(regiao('Colunas'), 'Fazendo'))
    await user.click(lixeira!)
    expect(screen.getByText('Excluir coluna "Fazendo"')).toBeInTheDocument()
    expect(exclusoes).toEqual([])
    // O destino padrão é a primeira outra coluna; aqui a pessoa escolhe outra.
    const destino = screen.getByText('Excluir coluna "Fazendo"').parentElement!.querySelector('select')!
    expect(destino.value).toBe('c-fazer')
    await user.selectOptions(destino, 'c-feito')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(exclusoes).toEqual([['c-fazendo', 'c-feito']])
  })
})

describe('OrganizationSettingsSections — membros & squads', () => {
  test('cria squad e excluir squad passa por confirmação', async () => {
    const criados: string[] = []
    const excluidos: string[] = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({
      onCreateSquad: async (nome: string) => { criados.push(nome) },
      onDeleteSquad: async (squad: Squad) => { excluidos.push(squad.id) },
    })} />)

    const secao = regiao('Membros & Squads')
    await user.type(within(secao).getByPlaceholderText('Nome do squad'), 'Squad Beta')
    await user.click(within(secao).getByRole('button', { name: 'Criar squad' }))
    expect(criados).toEqual(['Squad Beta'])

    const [, lixeira] = botoesSemNome(within(secao).getByText('Squad Alfa', { selector: 'span.text-sm' }).closest('div.flex.items-center.justify-between') as HTMLElement)
    await user.click(lixeira!)
    expect(screen.getByText('Excluir squad "Squad Alfa"')).toBeInTheDocument()
    expect(excluidos).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(excluidos).toEqual(['s1'])
  })

  test('remover membro passa por confirmação; o próprio usuário não pode se remover', async () => {
    const removidos: string[] = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({ onRemoveMember: async (membro: Member) => { removidos.push(membro.userId) } })} />)

    const secao = regiao('Membros & Squads')
    const [, lixeiraAna] = botoesSemNome(within(secao).getByText('ana@empresa.com').closest('div.flex.items-center.justify-between') as HTMLElement)
    expect(lixeiraAna).toBeDisabled()

    const [, lixeiraBruno] = botoesSemNome(within(secao).getByText('bruno@empresa.com').closest('div.flex.items-center.justify-between') as HTMLElement)
    await user.click(lixeiraBruno!)
    expect(screen.getByText('Remover membro')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(removidos).toEqual(['u2'])
  })

  test('Adicionar membro abre o dialog de adição', async () => {
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps()} />)
    await user.click(within(regiao('Membros & Squads')).getByRole('button', { name: 'Adicionar membro' }))
    // PB1 — o diálogo é carregado sob demanda: aparece quando o chunk chega.
    expect(await screen.findByRole('dialog', { name: 'Adicionar membro' })).toBeInTheDocument()
  })
})

describe('OrganizationSettingsSections — centros de custo', () => {
  test('lista e cria centro de custo com código e descrição', async () => {
    const criados: Array<[string, string]> = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({ onCreateCostCenter: async (codigo: string, descricao: string) => { criados.push([codigo, descricao]) } })} />)

    const secao = regiao('Centros de Custo')
    expect(within(secao).getByText('CC-001')).toBeInTheDocument()
    expect(within(secao).getByText('Operação')).toBeInTheDocument()
    await user.type(within(secao).getByPlaceholderText('Código (ex.: CC-001)'), 'CC-002')
    await user.type(within(secao).getByPlaceholderText('Descrição (opcional)'), 'Projetos')
    await user.click(within(secao).getByRole('button', { name: 'Adicionar' }))
    expect(criados).toEqual([['CC-002', 'Projetos']])
  })

  test('excluir centro de custo chama a exclusão direto, sem confirmação', async () => {
    const excluidos: string[] = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({ onDeleteCostCenter: async (id: string) => { excluidos.push(id) } })} />)

    const [, lixeira] = botoesSemNome(linhaDe(regiao('Centros de Custo'), 'CC-001'))
    await user.click(lixeira!)
    expect(excluidos).toEqual(['cc1'])
  })
})

describe('OrganizationSettingsSections — gating de admin (A8-05)', () => {
  test('sem admin somem criar coluna, status base, criar squad, adicionar membro e criar centro de custo', () => {
    render(<OrganizationSettingsSections {...baseProps({ isAdmin: false })} />)

    const colunasSecao = regiao('Colunas')
    expect(within(colunasSecao).queryByPlaceholderText('Nome da coluna')).toBeNull()
    expect(within(colunasSecao).queryByRole('button', { name: 'Nova coluna' })).toBeNull()
    expect(within(colunasSecao).queryAllByRole('combobox', { name: 'Status base da coluna' })).toHaveLength(0)
    // O status base aparece só como texto e o peso fica desabilitado.
    expect(within(colunasSecao).getByLabelText('Peso Fazendo')).toBeDisabled()
    expect(within(colunasSecao).queryAllByRole('button')).toHaveLength(0) // sem editar/excluir/restaurar

    const membrosSecao = regiao('Membros & Squads')
    expect(within(membrosSecao).queryByRole('button', { name: 'Criar squad' })).toBeNull()
    expect(within(membrosSecao).queryByRole('button', { name: 'Adicionar membro' })).toBeNull()
    // Continua visível para todos: ver estrutura.
    expect(within(membrosSecao).getByRole('button', { name: 'Ver estrutura' })).toBeInTheDocument()

    const centrosSecao = regiao('Centros de Custo')
    expect(within(centrosSecao).queryByPlaceholderText('Código (ex.: CC-001)')).toBeNull()
    expect(within(centrosSecao).queryByRole('button', { name: 'Adicionar' })).toBeNull()
  })
})
