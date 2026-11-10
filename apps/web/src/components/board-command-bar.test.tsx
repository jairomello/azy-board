import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { BoardCommandBar } from './BoardCommandBar'
import type { BoardFilterState } from './BoardFilters'

const baseFilters: BoardFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [], versionId: '', priority: '', status: '',
  authorId: '', costCenterId: '', updatedWithin: '', hideEmptyEpics: false, hideEmptyStories: false, squadId: '',
  showSubtasks: false, storyDisplay: 'lanes', moduleViewMode: 'hierarchy',
}

function renderBar(filters: BoardFilterState, onFiltersChange: (next: BoardFilterState) => void) {
  render(
    <BoardCommandBar
      view="tree"
      onViewChange={() => {}}
      density="comfortable"
      onDensityChange={() => {}}
      modules={[]}
      boardMode="HIERARCHICAL"
      sprints={[]}
      members={[]}
      squads={[]}
      tags={[]}
      versions={[]}
      costCenters={[]}
      filters={filters}
      onFiltersChange={onFiltersChange}
      onExpandAll={() => {}}
      onCollapseAll={() => {}}
      onOpenArchived={() => {}}
      onCreate={() => {}}
    />,
  )
}

describe('BoardCommandBar — limpar filtro sempre visível quando há filtro aplicado', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  test('mostra o botão de limpar fora do popover quando existe filtro ativo', async () => {
    renderBar({ ...baseFilters, status: 'IN_PROGRESS' }, () => {})
    // O botão de filtros já mostra o contador; o limpar precisa estar visível sem abrir o menu.
    expect(await screen.findByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpar filtros' }).textContent).toContain('1')
  })

  test('não mostra o limpar quando não há filtro ativo', async () => {
    renderBar(baseFilters, () => {})
    await screen.findByRole('button', { name: 'Filtros' })
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
  })

  test('limpar zera os filtros de população e preserva as preferências de exibição', async () => {
    const user = userEvent.setup()
    const changes: BoardFilterState[] = []
    renderBar({ ...baseFilters, status: 'DONE', priority: 'HIGH', showSubtasks: true, storyDisplay: 'cards' }, next => changes.push(next))

    await user.click(await screen.findByRole('button', { name: 'Limpar filtros' }))

    const limpo = changes[changes.length - 1]!
    expect(limpo.status).toBe('')
    expect(limpo.priority).toBe('')
    expect(limpo.showSubtasks).toBe(true)
    expect(limpo.storyDisplay).toBe('cards')
  })
})
