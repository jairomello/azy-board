import { screen } from '../../../test/setup'
import '../../../i18n'
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardLanes } from './BoardLanes'
import type { ItemData, Module } from '../model/types'

const epic = { id: 'epic-1', title: 'Epic A', type: 'EPIC', isLeaf: false, status: 'NOT_STARTED', points: 5 } as unknown as ItemData
const task = { id: 'task-1', title: 'Tarefa', type: 'TASK', isLeaf: true, status: 'NOT_STARTED', columnId: 'col-1' } as unknown as ItemData
const module = { id: 'mod-1', name: 'Módulo Um' } as unknown as Module

function renderLanes(overrides: Partial<Parameters<typeof BoardLanes>[0]> = {}) {
  const calls: Array<[string, string]> = []
  const noop = () => {}
  const props = {
    simpleBoard: false,
    simpleCards: [],
    showStoryLanes: false,
    orphanCards: [],
    moduleGroups: [{ module, epics: [{ epic, tasks: [task], storyGroups: [] }] }],
    visibleModuleGroups: [{ module, epics: [{ epic, tasks: [task], storyGroups: [] }] }],
    columns: [],
    versions: [],
    sprints: [],
    // Épico inicia recolhido para não montar as colunas (foco no toggle).
    collapsedEpics: new Set<string>(['epic-1']),
    collapsedModules: new Set<string>(),
    collapsedStories: new Set<string>(),
    columnAddForms: {},
    onToggleEpic: (id: string) => calls.push(['epic', id]),
    onToggleModule: (id: string) => calls.push(['module', id]),
    onToggleStory: (id: string) => calls.push(['story', id]),
    onShowAddForm: noop,
    onHideAddForm: noop,
    onCardCreate: async () => {},
    onOpenDetail: noop,
    onTitleSave: noop,
    onDelete: noop,
    onArchive: noop,
    onEditStory: noop,
    onEditEpic: noop,
    noModuleLabel: 'Sem módulo',
    ...overrides,
  }
  const view = render(<BoardLanes {...props} />)
  return { ...view, calls }
}

describe('BoardLanes — toggles dos accordions', () => {
  test('o cabeçalho do épico chama onToggleEpic ao ser clicado', async () => {
    const { calls } = renderLanes()
    await userEvent.click(screen.getByRole('button', { name: /Epic A/ }))
    expect(calls.some(call => call[0] === 'epic' && call[1] === 'epic-1')).toBe(true)
  })

  test('o cabeçalho do módulo chama onToggleModule ao ser clicado', async () => {
    const { calls } = renderLanes()
    await userEvent.click(screen.getByRole('button', { name: /Módulo Um/ }))
    expect(calls.some(call => call[0] === 'module' && call[1] === 'mod-1')).toBe(true)
  })
})
