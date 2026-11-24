import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ICON_COLORS } from '@azy-board/ui-contracts'
import i18n from '../../../i18n'
import { GeneralSettingsSections } from './GeneralSettingsSections'

// Teste de caracterização (P0 — rede de segurança do redesenho de Configurações).
// Prende o comportamento atual das seções gerais no nível do componente, com todas
// as seções abertas, para continuar válido quando a navegação (sanfona → grupos)
// mudar. Cobre A8-04 (gating de admin) e a ação principal de cada seção.

const TODAS_AS_SECOES = new Set(['board-format', 'appearance', 'visibility', 'checklists', 'planning', 'manager'])

const membros = [
  { userId: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', role: 'ADMIN', squadId: null, squadName: null },
  { userId: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', role: 'MEMBER', squadId: null, squadName: null },
]

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    boardMode: 'HIERARCHICAL' as const,
    isRestricted: false, isHidden: false, advancedChecklists: false,
    hideModules: false, hideEpics: false,
    startDate: '', plannedEndDate: '', plannedPoints: '', plannedHours: '', scope: '',
    icon: null, color: null, manager: null, managerUserId: '', members: membros, isAdmin: true,
    openSections: TODAS_AS_SECOES, onToggleSection: () => {},
    onBoardModeChange: () => {}, onAppearanceChange: () => {}, savingAppearance: false, appearanceError: '',
    onVisibilityChange: () => {}, onAdvancedChecklistsChange: () => {},
    onPlanningChange: () => {}, onPlanningFieldChange: () => {}, onManagerChange: () => {}, onScopeChange: () => {},
    pendingBoardMode: null, savingBoardMode: false, boardModeError: '', savingVisibility: false, visibilityError: '',
    savingAdvancedChecklists: false, advancedChecklistsError: '', savingPlanning: false, planningError: '',
    savingManager: false, onConfirmBoardMode: () => {}, onCancelBoardMode: () => {}, onSaveManager: () => {},
    onCollapseChange: () => {}, pendingCollapse: null, savingCollapse: false, collapseError: '',
    onConfirmCollapse: () => {}, onCancelCollapse: () => {},
    ...overrides,
  }
}

const regiao = (nome: string) => screen.getByRole('region', { name: nome })

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('GeneralSettingsSections — caracterização das seções gerais', () => {
  test('renderiza as seis seções gerais com seus títulos', () => {
    render(<GeneralSettingsSections {...baseProps()} />)
    for (const titulo of ['Formato do board', 'Aparência', 'Visibilidade do projeto', 'Checklists detalhados', 'Planejamento', 'Gerente Geral do Projeto']) {
      expect(regiao(titulo)).toBeInTheDocument()
    }
  })

  test('formato do board: escolher Simples e Hierárquico dispara a troca de formato', () => {
    const trocas: string[] = []
    const { unmount } = render(<GeneralSettingsSections {...baseProps({ onBoardModeChange: (modo: string) => trocas.push(modo) })} />)
    fireEvent.click(within(regiao('Formato do board')).getByRole('radio', { name: /Simples/ }))
    expect(trocas).toEqual(['SIMPLE'])
    unmount()

    render(<GeneralSettingsSections {...baseProps({ boardMode: 'SIMPLE', onBoardModeChange: (modo: string) => trocas.push(modo) })} />)
    fireEvent.click(within(regiao('Formato do board')).getByRole('radio', { name: /Hierárquico/ }))
    expect(trocas).toEqual(['SIMPLE', 'HIERARCHICAL'])
  })

  test('formato do board: conversão para Simples pede confirmação e confirma/cancela', async () => {
    let confirmou = 0
    let cancelou = 0
    const user = userEvent.setup()
    render(<GeneralSettingsSections {...baseProps({ pendingBoardMode: 'SIMPLE', onConfirmBoardMode: () => { confirmou += 1 }, onCancelBoardMode: () => { cancelou += 1 } })} />)

    const dialogo = screen.getByRole('dialog', { name: 'Usar board simples?' })
    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar conversão' }))
    expect(confirmou).toBe(1)
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(cancelou).toBe(1)
  })

  test('aparência: escolher uma cor propaga ícone e cor imediatamente', async () => {
    const mudancas: Array<{ icon: string | null; color: string | null }> = []
    const user = userEvent.setup()
    render(<GeneralSettingsSections {...baseProps({ icon: 'rocket', onAppearanceChange: (valor: { icon: string | null; color: string | null }) => mudancas.push(valor) })} />)

    await user.click(within(regiao('Aparência')).getByRole('button', { name: 'Aparência', expanded: false }))
    const cor = ICON_COLORS[0]!
    await user.click(within(screen.getByRole('dialog', { name: 'Aparência' })).getByRole('button', { name: cor }))
    expect(mudancas).toEqual([{ icon: 'rocket', color: cor }])
  })

  test('visibilidade: os interruptores Restrito e Oculto disparam a mudança do campo certo', async () => {
    const mudancas: Array<[string, boolean]> = []
    const user = userEvent.setup()
    render(<GeneralSettingsSections {...baseProps({ isHidden: true, onVisibilityChange: (campo: string, valor: boolean) => mudancas.push([campo, valor]) })} />)

    const secao = regiao('Visibilidade do projeto')
    await user.click(within(secao).getByRole('switch', { name: 'Restrito' }))
    await user.click(within(secao).getByRole('switch', { name: 'Oculto' }))
    expect(mudancas).toEqual([['isRestricted', true], ['isHidden', false]])
  })

  test('checklists: o interruptor liga os checklists detalhados', async () => {
    const valores: boolean[] = []
    const user = userEvent.setup()
    render(<GeneralSettingsSections {...baseProps({ onAdvancedChecklistsChange: (valor: boolean) => valores.push(valor) })} />)

    await user.click(within(regiao('Checklists detalhados')).getByRole('switch'))
    expect(valores).toEqual([true])
  })

  test('planejamento: sair do campo grava a data e as estimativas numéricas', async () => {
    const user = userEvent.setup()
    const gravados: Array<[string, unknown]> = []
    const rascunhos: Array<[string, string]> = []
    render(<GeneralSettingsSections {...baseProps({
      onPlanningChange: (campo: string, valor: unknown) => gravados.push([campo, valor]),
      onPlanningFieldChange: (campo: string, valor: string) => rascunhos.push([campo, valor]),
    })} />)

    const secao = regiao('Planejamento')
    const pontos = within(secao).getByLabelText('Total de Pontos Previsto')
    await user.type(pontos, '4')
    expect(rascunhos).toEqual([['plannedPoints', '4']])
    fireEvent.blur(within(secao).getByLabelText('Data de Início'), { target: { value: '2026-12-01' } })
    fireEvent.blur(pontos, { target: { value: '40' } })
    fireEvent.blur(within(secao).getByLabelText('Total de Horas Previsto'), { target: { value: '' } })
    expect(gravados).toEqual([['startDate', '2026-12-01'], ['plannedPoints', 40], ['plannedHours', null]])
  })

  test('gerente: escolher um membro e salvar dispara a troca e a gravação', async () => {
    const escolhidos: string[] = []
    let salvou = 0
    const user = userEvent.setup()
    render(<GeneralSettingsSections {...baseProps({
      manager: { id: 'u1', name: 'Ana Souza', email: 'ana@empresa.com' },
      managerUserId: 'u1',
      onManagerChange: (valor: string) => escolhidos.push(valor),
      onSaveManager: () => { salvou += 1 },
    })} />)

    const secao = regiao('Gerente Geral do Projeto')
    expect(within(secao).getByText('ana@empresa.com')).toBeInTheDocument()
    const select = within(secao).getByRole('combobox')
    expect(within(select).getByRole('option', { name: 'Sem gerente' })).toBeInTheDocument()
    await user.selectOptions(select, 'u2')
    await user.click(within(secao).getByRole('button', { name: 'Salvar' }))
    expect(escolhidos).toEqual(['u2'])
    expect(salvou).toBe(1)
  })
})

describe('GeneralSettingsSections — gating de admin (A8-04/A8-05)', () => {
  test('sem admin os controles ficam desabilitados e cada seção mostra o aviso adminOnly', () => {
    render(<GeneralSettingsSections {...baseProps({ isAdmin: false })} />)
    const aviso = 'Somente administradores podem alterar esta configuração.'

    const formato = regiao('Formato do board')
    for (const radio of within(formato).getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(within(formato).getByLabelText('Não exibir módulos')).toBeDisabled()
    expect(within(formato).getByLabelText('Não exibir épicos')).toBeDisabled()
    expect(within(formato).getByText(aviso)).toBeInTheDocument()

    const aparencia = regiao('Aparência')
    expect(within(aparencia).getByRole('button', { name: 'Aparência' })).toBeDisabled()
    expect(within(aparencia).getByText(aviso)).toBeInTheDocument()

    const visibilidade = regiao('Visibilidade do projeto')
    for (const interruptor of within(visibilidade).getAllByRole('switch')) expect(interruptor).toBeDisabled()
    expect(within(visibilidade).getByText(aviso)).toBeInTheDocument()

    const checklists = regiao('Checklists detalhados')
    expect(within(checklists).getByRole('switch')).toBeDisabled()
    expect(within(checklists).getByText(aviso)).toBeInTheDocument()

    const planejamento = regiao('Planejamento')
    for (const rotulo of ['Data de Início', 'Data de Fim Previsto', 'Total de Pontos Previsto', 'Total de Horas Previsto']) {
      expect(within(planejamento).getByLabelText(rotulo)).toBeDisabled()
    }
    expect(within(planejamento).getByText(aviso)).toBeInTheDocument()

    // Gerente: o select e o botão de salvar somem para quem não é admin.
    const gerente = regiao('Gerente Geral do Projeto')
    expect(within(gerente).queryByRole('combobox')).toBeNull()
    expect(within(gerente).queryByRole('button', { name: 'Salvar' })).toBeNull()

    expect(screen.getAllByText(aviso)).toHaveLength(5)
  })

  test('com admin os controles ficam habilitados e o aviso adminOnly não aparece', () => {
    render(<GeneralSettingsSections {...baseProps()} />)
    expect(screen.queryByText('Somente administradores podem alterar esta configuração.')).toBeNull()
    for (const radio of within(regiao('Formato do board')).getAllByRole('radio')) expect(radio).toBeEnabled()
    for (const interruptor of within(regiao('Visibilidade do projeto')).getAllByRole('switch')) expect(interruptor).toBeEnabled()
    expect(within(regiao('Checklists detalhados')).getByRole('switch')).toBeEnabled()
    expect(within(regiao('Planejamento')).getByLabelText('Data de Início')).toBeEnabled()
    expect(within(regiao('Gerente Geral do Projeto')).getByRole('combobox')).toBeInTheDocument()
  })
})
