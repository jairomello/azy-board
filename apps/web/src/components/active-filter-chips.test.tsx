import { screen } from '../test/setup'
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BoardFilterState } from './BoardFilters'
import { ActiveFilterChips, type ActiveFilterCatalogs, type ActiveFilterKey, type ActiveFilterLabels } from './ActiveFilterChips'

const labels: ActiveFilterLabels = {
  filterLabel: 'Filtros ativos', module: 'Módulo', sprint: 'Sprint', version: 'Versão', squad: 'Squad', assignee: 'Responsável', author: 'Autor',
  costCenter: 'Centro de custo', priority: 'Prioridade', status: 'Situação', type: 'Tipo', tag: 'Tag', hideEmptyEpics: 'Ocultar épicos vazios', hideEmptyStories: 'Ocultar histórias vazias', showSubtasks: 'Mostrar subtasks', storyDisplay: 'Histórias', moduleViewMode: 'Módulos',
  typeValues: { TASK: 'Task', BUG: 'Bug' }, priorityValues: { HIGH: 'Alta' }, statusValues: { DONE: 'Concluída' }, storyDisplayCards: 'como cards', moduleViewTabs: 'como abas', enabled: 'ativado', remove: 'Remover filtro',
}

const filters: BoardFilterState = {
  moduleId: 'module-1', sprintId: '', assigneeId: '', squadId: '', types: ['TASK'], tagIds: [], versionId: '', priority: '', status: '', authorId: '', costCenterId: '',
  hideEmptyEpics: false, hideEmptyStories: false, showSubtasks: false, storyDisplay: 'lanes', moduleViewMode: 'hierarchy',
}

const catalogs: ActiveFilterCatalogs = {
  modules: [{ id: 'module-1', name: 'Pagamentos' }], sprints: [], versions: [], squads: [], members: [], tags: [], costCenters: [],
}

describe('ActiveFilterChips', () => {
  test('não renderiza a linha quando não há filtros ativos', () => {
    const { container } = render(
      <ActiveFilterChips filters={{ ...filters, moduleId: '', types: [] }} catalogs={catalogs} labels={labels} onRemove={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('expõe a linha e os chips como lista acessível', () => {
    render(<ActiveFilterChips filters={filters} catalogs={catalogs} labels={labels} onRemove={() => {}} />)

    expect(screen.getByRole('list', { name: 'Filtros ativos' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Pagamentos')).toBeInTheDocument()
  })

  test('remove o filtro acionado com a chave e o valor corretos', async () => {
    const user = userEvent.setup()
    const removidos: Array<{ key: ActiveFilterKey; value?: string }> = []
    render(<ActiveFilterChips filters={filters} catalogs={catalogs} labels={labels} onRemove={(key, value) => removidos.push({ key, value })} />)

    await user.click(screen.getByRole('button', { name: 'Remover filtro: Módulo Pagamentos' }))

    expect(removidos).toEqual([{ key: 'moduleId', value: 'module-1' }])
  })
})
