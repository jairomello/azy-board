import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import i18n from '../../../i18n'
import { OrganizationSettingsSections } from './OrganizationSettingsSections'
import type { Column } from '../model/types'

const baseColumns = (): Column[] => [
  { id: 'c-backlog', name: 'Backlog', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
  { id: 'c-fazer', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 1, progressWeight: 0, progressWeightOverride: null },
  { id: 'c-fazendo', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 2, progressWeight: 50, progressWeightOverride: null },
  { id: 'c-testar', name: 'A Testar', baseStatus: 'IN_PROGRESS', position: 3, progressWeight: 70, progressWeightOverride: null },
  { id: 'c-testando', name: 'Testando', baseStatus: 'IN_PROGRESS', position: 4, progressWeight: 90, progressWeightOverride: null },
  { id: 'c-done', name: 'Concluídas', baseStatus: 'DONE', position: 5, progressWeight: 100, progressWeightOverride: null },
]

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    columns: baseColumns(),
    members: [], squads: [], costCenters: [], manager: null,
    isAdmin: true,
    openSections: new Set(['columns']), onToggleSection: () => {},
    onCreateColumn: async () => {}, onRenameColumn: async () => {}, onDeleteColumn: async () => {},
    onUpdateColumnWeight: async () => {},
    onCreateSquad: async () => {}, onRenameSquad: async () => {}, onDeleteSquad: async () => {},
    onAddMembers: async () => ({ ok: true, created: [], skipped: [], invalid: [] }), onEditMember: async () => {}, onRemoveMember: async () => {},
    onCreateCostCenter: async () => {}, onEditCostCenter: async () => {}, onDeleteCostCenter: async () => {},
    ...overrides,
  }
}

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('peso de avanço nas configurações do projeto', () => {
  test('mostra o peso efetivo e o derivado como sugestão', () => {
    render(<OrganizationSettingsSections {...baseProps()} />)

    expect(document.querySelector('[data-column-weight-effective="c-fazendo"]')?.textContent).toBe('50%')
    expect(document.querySelector('[data-column-weight-effective="c-testar"]')?.textContent).toBe('70%')
    expect(document.querySelector('[data-column-weight-effective="c-testando"]')?.textContent).toBe('90%')
    expect(document.querySelector('[data-column-weight-effective="c-done"]')?.textContent).toBe('100%')

    const input = screen.getByLabelText('Peso A Testar') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toBe('70')
  })

  test('sem permissão de administração o campo fica desabilitado e sem ação de restaurar', () => {
    render(<OrganizationSettingsSections {...baseProps({
      isAdmin: false,
      columns: baseColumns().map(column => column.id === 'c-testar' ? { ...column, progressWeight: 80, progressWeightOverride: 80 } : column),
    })} />)

    expect((screen.getByLabelText('Peso A Testar') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Restaurar peso derivado A Testar' })).toBeNull()
  })

  test('com valor explícito mostra o override e a ação de restaurar o derivado', async () => {
    const calls: Array<{ id: string; weight: number | null }> = []
    render(<OrganizationSettingsSections {...baseProps({
      columns: baseColumns().map(column => column.id === 'c-testar' ? { ...column, progressWeight: 80, progressWeightOverride: 80 } : column),
      onUpdateColumnWeight: async (id: string, weight: number | null) => { calls.push({ id, weight }) },
    })} />)

    const input = screen.getByLabelText('Peso A Testar') as HTMLInputElement
    expect(input.value).toBe('80')
    expect(document.querySelector('[data-column-weight-effective="c-testar"]')?.textContent).toBe('80%')

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar peso derivado A Testar' }))
    expect(calls).toEqual([{ id: 'c-testar', weight: null }])
  })

  test('digitar um valor grava o peso limitado a 0–100', async () => {
    const calls: Array<{ id: string; weight: number | null }> = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({
      onUpdateColumnWeight: async (id: string, weight: number | null) => { calls.push({ id, weight }) },
    })} />)

    const input = screen.getByLabelText('Peso A Testar')
    await user.clear(input)
    await user.type(input, '85')
    await user.tab()
    expect(calls).toEqual([{ id: 'c-testar', weight: 85 }])

    const beyond = screen.getByLabelText('Peso Fazendo')
    await user.clear(beyond)
    await user.type(beyond, '140')
    await user.tab()
    expect(calls).toEqual([{ id: 'c-testar', weight: 85 }, { id: 'c-fazendo', weight: 100 }])
  })

  test('esvaziar o campo com valor explícito restaura o derivado', async () => {
    const calls: Array<{ id: string; weight: number | null }> = []
    const user = userEvent.setup()
    render(<OrganizationSettingsSections {...baseProps({
      columns: baseColumns().map(column => column.id === 'c-testar' ? { ...column, progressWeight: 80, progressWeightOverride: 80 } : column),
      onUpdateColumnWeight: async (id: string, weight: number | null) => { calls.push({ id, weight }) },
    })} />)

    const input = screen.getByLabelText('Peso A Testar')
    await user.clear(input)
    await user.tab()
    expect(calls).toEqual([{ id: 'c-testar', weight: null }])
  })

  test('o indicador reflete o novo peso sem recarregar a aplicação', async () => {
    // Espelha o que a invalidação do cache faz: o pai passa a nova lista de colunas.
    function Harness() {
      const [columns, setColumns] = useState<Column[]>(baseColumns())
      return <OrganizationSettingsSections {...baseProps({
        columns,
        onUpdateColumnWeight: async (id: string, weight: number | null) => {
          setColumns(previous => previous.map(column => column.id === id
            ? { ...column, progressWeight: weight ?? 70, progressWeightOverride: weight }
            : column))
        },
      })} />
    }
    const user = userEvent.setup()
    render(<Harness />)

    expect(document.querySelector('[data-column-weight-effective="c-testar"]')?.textContent).toBe('70%')
    const input = screen.getByLabelText('Peso A Testar')
    await user.clear(input)
    await user.type(input, '95')
    await user.tab()
    expect(document.querySelector('[data-column-weight-effective="c-testar"]')?.textContent).toBe('95%')
    expect(screen.getByRole('button', { name: 'Restaurar peso derivado A Testar' })).toBeInTheDocument()
  })
})
