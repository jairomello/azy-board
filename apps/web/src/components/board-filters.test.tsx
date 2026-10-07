import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { BoardFilters, type BoardFilterState } from './BoardFilters'
import { EMPTY_FILTER_VALUE } from '../features/board/model/types'

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, { ns: 'board', ...options })

const baseFilters: BoardFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [], versionId: '', priority: '', status: '',
  authorId: '', costCenterId: '', hideEmptyEpics: false, hideEmptyStories: false, squadId: '', showSubtasks: false,
  storyDisplay: 'lanes', moduleViewMode: 'hierarchy',
}

function renderFilters(overrides: Partial<BoardFilterState> = {}, onChange: (f: BoardFilterState) => void = () => {}) {
  render(
    <BoardFilters
      modules={[{ id: 'module-1', name: 'Pagamentos' }]}
      sprints={[{ id: 'sprint-1', name: 'Sprint 1', status: 'OPEN' }]}
      members={[{ userId: 'user-1', name: 'Ana' }]}
      tags={[{ id: 'tag-1', name: 'Urgente', color: '#f00' }]}
      versions={[{ id: 'version-1', name: 'v1' }]}
      costCenters={[{ id: 'cc-1', code: 'CC1', description: null, sortOrder: 0 }]}
      squads={[{ id: 'squad-1', name: 'Squad A' }]}
      filters={{ ...baseFilters, ...overrides }}
      onChange={onChange}
      showSubtasks={overrides.showSubtasks ?? false}
      onToggleSubtasks={() => {}}
      storiesAsCards={false}
      onToggleStoryDisplay={() => {}}
      showExpandCollapse
      onExpandAll={() => {}}
      onCollapseAll={() => {}}
    />,
  )
}

describe('BoardFilters (DOM por papel/rótulo)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  test('filtra por módulo usando o combobox rotulado', async () => {
    const user = userEvent.setup()
    const mudancas: BoardFilterState[] = []
    renderFilters({}, f => mudancas.push(f))

    await user.selectOptions(screen.getByRole('combobox', { name: t('filterModule') }), 'module-1')

    expect(mudancas[mudancas.length - 1]?.moduleId).toBe('module-1')
  })

  test('filtra por sprint vazia pelo valor sentinela', async () => {
    const user = userEvent.setup()
    const mudancas: BoardFilterState[] = []
    renderFilters({}, f => mudancas.push(f))

    await user.selectOptions(screen.getByRole('combobox', { name: t('filterSprint') }), EMPTY_FILTER_VALUE)

    expect(mudancas[mudancas.length - 1]?.sprintId).toBe(EMPTY_FILTER_VALUE)
  })

  test('alterna filtro de tipo por botão acessível', async () => {
    const user = userEvent.setup()
    const mudancas: BoardFilterState[] = []
    renderFilters({}, f => mudancas.push(f))

    await user.click(screen.getByRole('button', { name: t('typeTask') }))

    expect(mudancas[mudancas.length - 1]?.types).toEqual(['TASK'])
  })

  test('alterna a visão de módulo para abas', async () => {
    const user = userEvent.setup()
    const mudancas: BoardFilterState[] = []
    renderFilters({}, f => mudancas.push(f))

    await user.click(screen.getByRole('button', { name: t('moduleViewTabs') }))

    expect(mudancas[mudancas.length - 1]?.moduleViewMode).toBe('tabs')
  })

  test('limpa os filtros de dados preservando subtasks, visão e modo de módulo', async () => {
    const user = userEvent.setup()
    const mudancas: BoardFilterState[] = []
    renderFilters({ moduleId: 'module-1', showSubtasks: true, storyDisplay: 'cards', moduleViewMode: 'tabs' }, f => mudancas.push(f))

    await user.click(screen.getByRole('button', { name: new RegExp(t('clear')) }))

    expect(mudancas[mudancas.length - 1]).toMatchObject({ moduleId: '', showSubtasks: true, storyDisplay: 'cards', moduleViewMode: 'tabs' })
  })

  test('não oferece limpar quando não há filtro ativo', () => {
    renderFilters()

    expect(screen.queryByRole('button', { name: new RegExp(t('clear')) })).toBeNull()
  })

  test('oculta filtros de dados na seção de opções', () => {
    render(
      <BoardFilters
        modules={[{ id: 'module-1', name: 'Pagamentos' }]} sprints={[]} members={[]} tags={[]} filters={baseFilters}
        onChange={() => {}} showSubtasks={false} onToggleSubtasks={() => {}} storiesAsCards={false} onToggleStoryDisplay={() => {}}
        section="options"
      />,
    )

    expect(screen.queryByRole('combobox', { name: t('filterModule') })).toBeNull()
    expect(screen.getByRole('button', { name: t('hideEmptyEpics') })).toBeInTheDocument()
  })

  test('todos os controles têm nome acessível', () => {
    renderFilters({ moduleId: 'module-1' })

    const controls = Array.from(document.querySelectorAll('button, select, input, [role="button"]'))
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) {
      expect(control).toHaveAccessibleName()
    }
  })
})
