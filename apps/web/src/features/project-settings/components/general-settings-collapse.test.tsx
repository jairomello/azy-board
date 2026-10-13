import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../../i18n'
import { GeneralSettingsSections } from './GeneralSettingsSections'

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    boardMode: 'HIERARCHICAL' as const,
    isRestricted: false, isHidden: false, advancedChecklists: false,
    hideModules: false, hideEpics: false,
    startDate: '', plannedEndDate: '', plannedPoints: '', plannedHours: '', scope: '',
    icon: null, color: null, manager: null, managerUserId: '', members: [], isAdmin: true,
    openSections: new Set(['board-format']), onToggleSection: () => {},
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

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('GeneralSettingsSections — ocultar níveis (T61)', () => {
  test('mostra os toggles em projeto hierárquico e dispara a mudança', async () => {
    const changes: Array<[string, boolean]> = []
    const user = userEvent.setup()
    render(<GeneralSettingsSections {...baseProps({ onCollapseChange: (field: string, value: boolean) => changes.push([field, value]) })} />)

    const modulesToggle = screen.getByLabelText('Não exibir módulos')
    expect(screen.getByLabelText('Não exibir épicos')).toBeInTheDocument()
    await user.click(modulesToggle)
    expect(changes).toEqual([['hideModules', true]])
  })

  test('não mostra os toggles em projeto simples', () => {
    render(<GeneralSettingsSections {...baseProps({ boardMode: 'SIMPLE' })} />)
    expect(screen.queryByLabelText('Não exibir módulos')).not.toBeInTheDocument()
  })

  test('confirmação ao ligar: confirmar e cancelar', async () => {
    let confirmed = 0
    let cancelled = 0
    const user = userEvent.setup()
    render(<GeneralSettingsSections {...baseProps({ pendingCollapse: 'hideModules', onConfirmCollapse: () => { confirmed += 1 }, onCancelCollapse: () => { cancelled += 1 } })} />)

    expect(screen.getByRole('dialog', { name: 'Ocultar este nível?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(confirmed).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(cancelled).toBe(1)
  })
})
