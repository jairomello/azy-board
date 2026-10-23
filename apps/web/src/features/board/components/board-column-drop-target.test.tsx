import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import i18n from '../../../i18n'
import { BoardColumns } from './BoardColumns'
import {
  BoardDragAnimationProvider,
  type BoardDragAnimationValue,
} from '../hooks/useBoardDragAnimation'
import { emptyPreview, type DragPreview } from '../model/dragPreview'
import type { Column, ItemData } from '../model/types'

const columns: Column[] = [
  { id: 'fazer', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
  { id: 'fazendo', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1, progressWeight: 50, progressWeightOverride: null },
]

const cards: ItemData[] = [
  { id: 'c1', type: 'TASK', title: 'Card um', status: 'NOT_STARTED', columnId: 'fazer', isLeaf: true, position: 0 },
  { id: 'c2', type: 'TASK', title: 'Card dois', status: 'NOT_STARTED', columnId: 'fazer', isLeaf: true, position: 1 },
] as ItemData[]

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    laneId: 'lane',
    columns,
    versions: [],
    sprints: [],
    tasks: [] as ItemData[],
    columnAddForms: {},
    onShowAddForm: () => {},
    onHideAddForm: () => {},
    onCardCreate: async () => {},
    onOpenDetail: () => {},
    onTitleSave: () => {},
    ...overrides,
  }
}

/** Estado do arraste: os handlers não são exercidos aqui, só o desenho. */
function animationCom(overrides: Partial<BoardDragAnimationValue> = {}): BoardDragAnimationValue {
  const preview: DragPreview = emptyPreview()
  return {
    preview,
    activeId: null,
    dragging: false,
    reducedMotion: false,
    validRef: { current: false },
    previewRef: { current: preview },
    onDragStart: () => {},
    onDragMove: () => {},
    onDragEnd: () => {},
    onDragCancel: () => {},
    ...overrides,
  }
}

function renderBoard(animation?: BoardDragAnimationValue) {
  const board = <DndContext><BoardColumns {...baseProps({ tasks: cards })} /></DndContext>
  return render(animation
    ? <BoardDragAnimationProvider value={animation}>{board}</BoardDragAnimationProvider>
    : board)
}

const destacadas = () => Array.from(document.querySelectorAll('.board-column-dropzone--over'))
  .map(element => element.closest('[data-drop-id]')?.getAttribute('data-drop-id'))
const vagas = () => Array.from(document.querySelectorAll('.kanban-card-placeholder'))

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('destino e vaga no arraste de cards (Card T89)', () => {
  test('cada coluna expõe o alvo medido para resolver a validade do destino', () => {
    renderBoard()
    const alvos = Array.from(document.querySelectorAll('[data-drop-id]')).map(element => element.getAttribute('data-drop-id'))
    expect(alvos).toEqual(['lane:col:fazer', 'lane:col:fazendo'])
  })

  test('a coluna sob o ponteiro recebe o destaque de destino, e só ela', () => {
    renderBoard(animationCom({
      dragging: true,
      activeId: 'c1',
      preview: { targetId: 'lane:col:fazendo', columnId: 'fazendo', index: 0, height: 164, anchorId: null, order: [] },
    }))
    expect(destacadas()).toEqual(['lane:col:fazendo'])
  })

  test('sem destino válido sob o ponteiro nenhuma coluna é destacada e não há vaga', () => {
    renderBoard(animationCom({ dragging: true, activeId: 'c1' }))
    expect(destacadas()).toEqual([])
    expect(vagas()).toHaveLength(0)
  })

  test('a vaga entra na coluna e no índice da prévia, com a altura do card', () => {
    renderBoard(animationCom({
      dragging: true,
      activeId: 'c1',
      preview: { targetId: 'lane:col:fazer', columnId: 'fazer', index: 1, height: 164, anchorId: null, order: ['c2'] },
    }))

    const lista = document.querySelector('[data-drop-id="lane:col:fazer"] .board-column-cards') as HTMLElement
    const filhos = Array.from(lista.children)
    expect(filhos[0]?.getAttribute('data-card-id')).toBe('c2')
    expect(filhos[1]?.classList.contains('kanban-card-placeholder')).toBe(true)
    expect((filhos[1] as HTMLElement).style.height).toBe('164px')
    expect(vagas()).toHaveLength(1)
  })

  test('o card arrastado sai do fluxo e não duplica conteúdo', () => {
    renderBoard(animationCom({
      dragging: true,
      activeId: 'c1',
      preview: { targetId: 'lane:col:fazendo', columnId: 'fazendo', index: 0, height: 164, anchorId: null, order: [] },
    }))

    const arrastado = document.querySelector('[data-card-id="c1"]') as HTMLElement
    expect(arrastado.classList.contains('kanban-card--dragging')).toBe(true)
    expect(arrastado.querySelector('.kanban-card-content')).toBeNull()
    // Só o `c2` continua com conteúdo na lista, além da vaga.
    expect(document.querySelectorAll('.board-column-cards .kanban-card-content')).toHaveLength(1)
  })

  test('a vaga não altera a contagem exibida das colunas', () => {
    renderBoard(animationCom({
      dragging: true,
      activeId: 'c1',
      preview: { targetId: 'lane:col:fazendo', columnId: 'fazendo', index: 0, height: 164, anchorId: null, order: [] },
    }))
    const contagens = screen.getAllByText('2')
    expect(contagens.length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.board-column-count')[0]?.textContent).toBe('2')
  })

  test('Card B14 — a vaga aparece só na lane do alvo, com a mesma coluna em várias lanes', () => {
    const animation = animationCom({
      dragging: true,
      activeId: null,
      preview: { targetId: 'lane-b:col:fazendo', columnId: 'fazendo', index: 1, height: 164, anchorId: null, order: [] },
    })
    render(
      <BoardDragAnimationProvider value={animation}>
        <DndContext>
          <BoardColumns {...baseProps({ laneId: 'lane-a' })} />
          <BoardColumns {...baseProps({ laneId: 'lane-b' })} />
        </DndContext>
      </BoardDragAnimationProvider>,
    )

    const vaga = document.querySelector('.kanban-card-placeholder') as HTMLElement | null
    expect(vaga).not.toBeNull()
    // O id da coluna se repete nas duas lanes: só o alvo prefixado pela lane identifica
    // a instância, então a vaga não pode ser desenhada nas duas.
    expect(document.querySelectorAll('.kanban-card-placeholder')).toHaveLength(1)
    expect(vaga!.closest('[data-drop-id]')?.getAttribute('data-drop-id')).toBe('lane-b:col:fazendo')
  })

  test('Card B14 — sem destino não há vaga em lane alguma', () => {
    const animation = animationCom({ dragging: true, activeId: null })
    render(
      <BoardDragAnimationProvider value={animation}>
        <DndContext>
          <BoardColumns {...baseProps({ laneId: 'lane-a' })} />
          <BoardColumns {...baseProps({ laneId: 'lane-b' })} />
        </DndContext>
      </BoardDragAnimationProvider>,
    )
    expect(document.querySelectorAll('.kanban-card-placeholder')).toHaveLength(0)
  })

  test('sem arraste instrumentado a coluna continua sem destaque em repouso', () => {
    renderBoard()
    expect(destacadas()).toEqual([])
    expect(vagas()).toHaveLength(0)
    expect(screen.getByText('A Fazer')).not.toBeNull()
  })
})
