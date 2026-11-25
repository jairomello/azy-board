import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../../i18n'
import { DeliverySettingsSections } from './DeliverySettingsSections'
import type { Module, ProjectVersion, Sprint } from '../model/types'

// Teste de caracterização (P0 — rede de segurança do redesenho de Configurações).
// Módulos, Sprints e Versões no nível do componente, com as seções abertas: cada
// ação principal chama o handler esperado e os controles só-admin somem sem admin.

const modulos: Module[] = [
  { id: 'm1', name: 'Financeiro', position: 0 },
  { id: 'm2', name: 'Logística', position: 1 },
]
const sprints: Sprint[] = [
  { id: 'sp1', name: 'Sprint 1', status: 'OPEN', startDate: '2026-11-01', endDate: '2026-11-14' },
  { id: 'sp2', name: 'Sprint 2', status: 'PROPOSED', startDate: '2026-11-15', endDate: '2026-11-28' },
]
const versoes: ProjectVersion[] = [
  { id: 'v1', name: 'v1.0.0', releaseDate: '2026-12-01', description: null, status: 'PLANNED', position: 0 },
]

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'p-1', boardMode: 'HIERARCHICAL' as const,
    modules: modulos, sprints, versions: versoes, isAdmin: true,
    openSections: new Set(['modules', 'sprints', 'versions']), onToggleSection: () => {},
    onCreateModule: async () => {}, onRenameModule: async () => {}, onCheckDeleteModule: async () => false, onDeleteModule: async () => {},
    onSaveSprint: async () => {}, onTransitionSprint: async () => {},
    onCreateVersion: async () => {}, onDeleteVersion: async () => {}, onSaveVersion: async () => {},
    ...overrides,
  }
}

const regiao = (nome: string) => screen.getByRole('region', { name: nome })
const linhaDe = (secao: HTMLElement, texto: string) => within(secao).getByText(texto).closest('div.flex.items-center.justify-between') as HTMLElement
const botoesSemNome = (linha: HTMLElement) => within(linha).getAllByRole('button').filter(botao => !botao.textContent?.trim())
// Inputs de data: o happy-dom não aceita digitação parcial em `type=date` e não entrega
// `input`/`change` ao React, que cai no polyfill de input (lê o valor no foco + keyup).
// Por isso o valor é gravado pelo setter nativo e o keyup faz o React percebê-lo.
function preencherData(campo: HTMLElement, valor: string) {
  fireEvent.focusIn(campo)
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(campo, valor)
  fireEvent.keyUp(campo)
}

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('DeliverySettingsSections — módulos', () => {
  test('só existe em board hierárquico', () => {
    const { unmount } = render(<DeliverySettingsSections {...baseProps()} />)
    expect(regiao('Módulos')).toBeInTheDocument()
    unmount()
    render(<DeliverySettingsSections {...baseProps({ boardMode: 'SIMPLE' })} />)
    expect(screen.queryByRole('region', { name: 'Módulos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Módulos' })).toBeNull()
  })

  test('cria módulo pelo formulário', async () => {
    const criados: string[] = []
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onCreateModule: async (nome: string) => { criados.push(nome) } })} />)

    const secao = regiao('Módulos')
    await user.type(within(secao).getByPlaceholderText('Nome do módulo'), 'Compras')
    await user.click(within(secao).getByRole('button', { name: 'Criar módulo' }))
    expect(criados).toEqual(['Compras'])
  })

  test('excluir módulo com épicos (409) abre a escolha de destino ou cascata', async () => {
    const verificados: string[] = []
    const excluidos: Array<[string, string]> = []
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({
      onCheckDeleteModule: async (modulo: Module) => { verificados.push(modulo.id); return true },
      onDeleteModule: async (modulo: Module, destino: string) => { excluidos.push([modulo.id, destino]) },
    })} />)

    const [, lixeira] = botoesSemNome(linhaDe(regiao('Módulos'), 'Financeiro'))
    await user.click(lixeira!)
    expect(verificados).toEqual(['m1'])
    await waitFor(() => expect(screen.getByText('Excluir módulo "Financeiro"')).toBeInTheDocument())
    // Sem destino escolhido a ação é "Excluir tudo" (cascata).
    expect(screen.getByRole('button', { name: 'Excluir tudo' })).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox'), 'm2')
    await user.click(screen.getByRole('button', { name: 'Mover e excluir' }))
    expect(excluidos).toEqual([['m1', 'm2']])
  })

  test('excluir módulo vazio não abre o diálogo', async () => {
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onCheckDeleteModule: async () => false })} />)
    const [, lixeira] = botoesSemNome(linhaDe(regiao('Módulos'), 'Financeiro'))
    await user.click(lixeira!)
    expect(screen.queryByText('Excluir módulo "Financeiro"')).toBeNull()
  })
})

describe('DeliverySettingsSections — sprints', () => {
  test('lista as sprints e cria uma nova com nome e datas', async () => {
    const salvas: Array<[{ name: string; startDate: string; endDate: string }, string | null]> = []
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onSaveSprint: async (dados: { name: string; startDate: string; endDate: string }, id: string | null) => { salvas.push([dados, id]) } })} />)

    const secao = regiao('Sprints')
    expect(within(secao).getByText('Sprint 1')).toBeInTheDocument()
    expect(within(secao).getByText('Sprint 2')).toBeInTheDocument()
    await user.type(within(secao).getByLabelText('Nome da sprint'), 'Sprint 3')
    preencherData(within(secao).getByLabelText('Data de início'), '2026-11-29')
    preencherData(within(secao).getByLabelText('Data de fim'), '2026-12-12')
    await user.click(within(secao).getByRole('button', { name: 'Criar sprint' }))
    await waitFor(() => expect(salvas).toEqual([[{ name: 'Sprint 3', startDate: '2026-11-29', endDate: '2026-12-12' }, null]]))
  })

  test('editar carrega a sprint no formulário e salva com o id', async () => {
    const salvas: Array<[{ name: string }, string | null]> = []
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onSaveSprint: async (dados: { name: string }, id: string | null) => { salvas.push([dados, id]) } })} />)

    const secao = regiao('Sprints')
    await user.click(within(linhaDe(secao, 'Sprint 2')).getByRole('button', { name: 'Editar' }))
    const nome = within(secao).getByLabelText('Nome da sprint') as HTMLInputElement
    expect(nome.value).toBe('Sprint 2')
    await user.type(nome, ' revisada')
    await user.click(within(secao).getByRole('button', { name: 'Salvar sprint' }))
    await waitFor(() => expect(salvas).toEqual([[{ name: 'Sprint 2 revisada', startDate: '2026-11-15', endDate: '2026-11-28' }, 'sp2']]))
  })

  test('PROPOSED oferece Abrir e OPEN oferece Fechar, cada um com sua transição', async () => {
    const transicoes: Array<[string, string]> = []
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onTransitionSprint: async (sprint: Sprint, acao: string) => { transicoes.push([sprint.id, acao]) } })} />)

    const secao = regiao('Sprints')
    expect(within(linhaDe(secao, 'Sprint 1')).queryByRole('button', { name: 'Abrir' })).toBeNull()
    expect(within(linhaDe(secao, 'Sprint 2')).queryByRole('button', { name: 'Fechar' })).toBeNull()
    await user.click(within(linhaDe(secao, 'Sprint 2')).getByRole('button', { name: 'Abrir' }))
    await user.click(within(linhaDe(secao, 'Sprint 1')).getByRole('button', { name: 'Fechar' }))
    expect(transicoes).toEqual([['sp2', 'open'], ['sp1', 'close']])
  })

  test('erro ao salvar a sprint aparece como alerta na seção', async () => {
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onSaveSprint: async () => { throw new Error('Datas sobrepostas') } })} />)
    const secao = regiao('Sprints')
    await user.type(within(secao).getByLabelText('Nome da sprint'), 'Sprint 3')
    preencherData(within(secao).getByLabelText('Data de início'), '2026-11-29')
    preencherData(within(secao).getByLabelText('Data de fim'), '2026-12-12')
    await user.click(within(secao).getByRole('button', { name: 'Criar sprint' }))
    expect(await within(secao).findByRole('alert')).toHaveTextContent('Datas sobrepostas')
  })
})

describe('DeliverySettingsSections — versões', () => {
  test('Nova versão abre o formulário e cria a versão com nome, data, status e descrição', async () => {
    const criadas: unknown[] = []
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onCreateVersion: async (dados: unknown) => { criadas.push(dados) } })} />)

    const secao = regiao('Versões')
    expect(within(secao).getByText('v1.0.0')).toBeInTheDocument()
    await user.click(within(secao).getByRole('button', { name: '+ Nova versão' }))
    await user.type(within(secao).getByPlaceholderText('Ex: v1.0.0'), 'v1.1.0')
    preencherData(secao.querySelector('form input[type="date"]') as HTMLElement, '2027-01-15')
    await user.selectOptions(within(secao).getByRole('combobox'), 'IN_DEV')
    await user.type(within(secao).getByPlaceholderText('Descrição opcional'), 'Correções')
    await user.click(within(secao).getByRole('button', { name: 'Criar versão' }))
    await waitFor(() => expect(criadas).toEqual([{ name: 'v1.1.0', releaseDate: '2027-01-15', description: 'Correções', status: 'IN_DEV' }]))
    // O formulário fecha depois de criar.
    expect(within(secao).queryByPlaceholderText('Ex: v1.0.0')).toBeNull()
  })

  test('a lixeira da versão chama a exclusão com o id', async () => {
    const excluidas: string[] = []
    const user = userEvent.setup()
    render(<DeliverySettingsSections {...baseProps({ onDeleteVersion: async (id: string) => { excluidas.push(id) } })} />)
    const linha = linhaDe(regiao('Versões'), 'v1.0.0')
    const [, , lixeira] = within(linha).getAllByRole('button')
    await user.click(lixeira!)
    expect(excluidas).toEqual(['v1'])
  })
})

describe('DeliverySettingsSections — gating de admin (A8-05)', () => {
  test('sem admin somem criar módulo, criar/editar/abrir/fechar sprint e criar/editar/excluir versão', () => {
    render(<DeliverySettingsSections {...baseProps({ isAdmin: false })} />)

    const modulosSecao = regiao('Módulos')
    expect(within(modulosSecao).queryByPlaceholderText('Nome do módulo')).toBeNull()
    expect(within(modulosSecao).queryAllByRole('button')).toHaveLength(0)

    const sprintsSecao = regiao('Sprints')
    expect(within(sprintsSecao).queryByLabelText('Nome da sprint')).toBeNull()
    expect(within(sprintsSecao).queryAllByRole('button')).toHaveLength(0)

    const versoesSecao = regiao('Versões')
    expect(within(versoesSecao).queryByRole('button', { name: '+ Nova versão' })).toBeNull()
    // Só resta o "Ver" da versão.
    const linha = linhaDe(versoesSecao, 'v1.0.0')
    expect(within(linha).getAllByRole('button')).toHaveLength(1)
    expect(within(linha).getByRole('button', { name: 'Ver' })).toBeInTheDocument()
  })
})
