// Testes de caracterização do lápis de edição nas lanes (A1-37), rede de
// segurança antes do redesenho do board: o lápis do épico chama `onEditEpic`
// com o épico e o lápis da história chama `onEditStory` com a história, sem
// recolher/expandir a lane. A lane órfã não tem lápis.
import { screen } from '../../../test/setup'
import i18n from '../../../i18n'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import { BoardLanes } from './BoardLanes'
import type { ItemData, Module, StoryLaneGroup } from '../model/types'

const epico = { id: 'epic-1', title: 'Épico A', type: 'EPIC', isLeaf: false, status: 'NOT_STARTED', ancestryPath: '[]' } as unknown as ItemData
const historia = { id: 'story-1', title: 'História A', type: 'STORY', isLeaf: false, status: 'NOT_STARTED', parentId: 'epic-1', ancestryPath: '[]' } as unknown as ItemData
const tarefa = { id: 'task-1', title: 'Tarefa', type: 'TASK', isLeaf: true, status: 'NOT_STARTED', columnId: 'col-1', ancestryPath: '[]' } as unknown as ItemData
const orfa = { id: 'task-orfa', title: 'Tarefa órfã', type: 'TASK', isLeaf: true, status: 'NOT_STARTED', columnId: 'col-1', ancestryPath: '[]' } as unknown as ItemData
const modulo = { id: 'mod-1', name: 'Módulo Um' } as unknown as Module

const grupoDaHistoria: StoryLaneGroup = { id: 'story-1', title: 'História A', story: historia, tasks: [tarefa] }

function renderLanes(overrides: Partial<Parameters<typeof BoardLanes>[0]> = {}) {
  const chamadas: Array<[string, string]> = []
  const nada = () => {}
  const grupos = [{ module: modulo, epics: [{ epic: epico, tasks: [tarefa], storyGroups: [grupoDaHistoria] }] }]
  render(
    <BoardLanes
      simpleBoard={false}
      simpleCards={[]}
      showStoryLanes
      orphanCards={[]}
      moduleGroups={grupos}
      visibleModuleGroups={grupos}
      columns={[]}
      versions={[]}
      sprints={[]}
      collapsedEpics={new Set<string>()}
      collapsedModules={new Set<string>()}
      // História recolhida: o foco é o cabeçalho, sem montar colunas.
      collapsedStories={new Set<string>(['story-1'])}
      columnAddForms={{}}
      onToggleEpic={id => chamadas.push(['alternarEpico', id])}
      onToggleModule={id => chamadas.push(['alternarModulo', id])}
      onToggleStory={id => chamadas.push(['alternarHistoria', id])}
      onShowAddForm={nada}
      onHideAddForm={nada}
      onCardCreate={async () => {}}
      onOpenDetail={id => chamadas.push(['abrir', id])}
      onTitleSave={nada}
      onDelete={nada}
      onArchive={nada}
      onEditStory={story => chamadas.push(['editarHistoria', story.id])}
      onEditEpic={epic => chamadas.push(['editarEpico', epic.id])}
      noModuleLabel="Sem módulo"
      {...overrides}
    />,
  )
  return chamadas
}

describe('BoardLanes — lápis de edição (A1-37)', () => {
  beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

  test('o lápis do épico chama onEditEpic com o épico e não alterna a lane', () => {
    const chamadas = renderLanes()
    fireEvent.click(screen.getByTitle('Editar épico'))
    expect(chamadas).toEqual([['editarEpico', 'epic-1']])
  })

  test('o lápis da história chama onEditStory com a história e não alterna a lane', () => {
    const chamadas = renderLanes()
    fireEvent.click(screen.getByRole('button', { name: 'Editar história História A' }))
    expect(chamadas).toEqual([['editarHistoria', 'story-1']])
  })

  test('agrupamento sem história (lane "sem história") não tem lápis', () => {
    const semHistoria: StoryLaneGroup = { id: 'sem-historia', title: 'Sem história', tasks: [tarefa] }
    const grupos = [{ module: modulo, epics: [{ epic: epico, tasks: [tarefa], storyGroups: [semHistoria] }] }]
    renderLanes({ moduleGroups: grupos, visibleModuleGroups: grupos, collapsedStories: new Set(['sem-historia']) })
    expect(screen.queryByRole('button', { name: /Editar história/ })).toBeNull()
    expect(screen.getByTitle('Editar épico')).toBeInTheDocument()
  })

  test('a lane órfã não tem lápis de edição', () => {
    renderLanes({ moduleGroups: [], visibleModuleGroups: [], orphanCards: [orfa], collapsedEpics: new Set(['orphan']) })
    expect(screen.getByText('Sem módulo')).toBeInTheDocument()
    expect(screen.queryByTitle('Editar épico')).toBeNull()
  })
})
