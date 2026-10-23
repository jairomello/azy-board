import { screen } from '../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import {
  BoardDragAnimationProvider,
  useBoardDragAnimation,
  useBoardDragAnimationValue,
  type BoardDragAnimationValue,
} from './hooks/useBoardDragAnimation'
import type { PreviewColumn, PreviewSource } from './model/dragPreview'

const caixa = { current: null as BoardDragAnimationValue | null }

const fonte: PreviewSource = { id: 'card-1', columnId: 'todo', height: 164 }
const colunas: PreviewColumn[] = [
  {
    id: 'lane:col:todo', columnId: 'todo', rect: { left: 100, right: 392, top: 200, bottom: 900 }, gap: 8,
    cards: [
      { id: 'card-1', top: 300, bottom: 464, height: 164 },
      { id: 'card-2', top: 472, bottom: 636, height: 164 },
    ],
  },
  {
    id: 'lane:col:doing', columnId: 'doing', rect: { left: 400, right: 692, top: 200, bottom: 900 }, gap: 8,
    cards: [{ id: 'card-3', top: 300, bottom: 464, height: 164 }],
  },
]

const measure = () => ({ columns: colunas, source: fonte })

function Quadro() {
  const value = useBoardDragAnimation(measure)
  caixa.current = value
  return (
    <BoardDragAnimationProvider value={value}>
      <span data-testid="coluna">{value.preview.columnId ?? 'nenhuma'}</span>
      <span data-testid="indice">{value.preview.index}</span>
      <span data-testid="altura">{value.preview.height}</span>
      <span data-testid="ancora">{value.preview.anchorId ?? 'nenhuma'}</span>
      <span data-testid="arrastando">{String(value.dragging)}</span>
      <span data-testid="ativo">{value.activeId ?? 'nenhum'}</span>
      <Consumidor />
    </BoardDragAnimationProvider>
  )
}

function Consumidor() {
  const value = useBoardDragAnimationValue()
  return <span data-testid="consumido">{value ? value.preview.columnId ?? 'nenhuma' : 'sem-provider'}</span>
}

function iniciar(clientX = 150, clientY = 350, id = 'card-1') {
  act(() => {
    caixa.current!.onDragStart({ active: { id }, activatorEvent: { clientX, clientY } } as unknown as DragStartEvent)
  })
}

function mover(delta: { x: number; y: number }) {
  act(() => {
    caixa.current!.onDragMove({ delta } as unknown as DragMoveEvent)
  })
}

function soltar(delta: { x: number; y: number }) {
  act(() => {
    caixa.current!.onDragEnd({ delta } as unknown as DragEndEvent)
  })
}

const texto = (id: string) => screen.getByTestId(id).textContent

describe('useBoardDragAnimation — prévia do arraste', () => {
  beforeEach(() => {
    caixa.current = null
    render(<Quadro />)
  })

  test('começa em repouso, sem prévia nem arraste', () => {
    expect(texto('coluna')).toBe('nenhuma')
    expect(texto('indice')).toBe('0')
    expect(texto('altura')).toBe('0')
    expect(texto('arrastando')).toBe('false')
    expect(texto('ativo')).toBe('nenhum')
    expect(caixa.current!.validRef.current).toBe(false)
  })

  test('expõe o estado pelo contexto do quadro', () => {
    expect(texto('consumido')).toBe('nenhuma')
    iniciar()
    expect(texto('consumido')).toBe('todo')
  })

  test('no início do arraste a vaga já nasce onde o ponteiro está', () => {
    iniciar()
    expect(texto('arrastando')).toBe('true')
    expect(texto('ativo')).toBe('card-1')
    expect(texto('coluna')).toBe('todo')
    expect(texto('altura')).toBe('164')
    // `card-2` sobe quando `card-1` sai do fluxo; o ponteiro acima do meio dele → vaga no topo.
    expect(texto('indice')).toBe('0')
    expect(texto('ancora')).toBe('card-2')
  })

  test('acompanha o ponteiro para outra coluna e pelo índice', () => {
    iniciar()
    mover({ x: 350, y: 0 })
    expect(texto('coluna')).toBe('doing')
    expect(texto('indice')).toBe('0')
    expect(texto('ancora')).toBe('card-3')
    expect(caixa.current!.validRef.current).toBe(true)

    mover({ x: 350, y: 200 })
    expect(texto('indice')).toBe('1')
    expect(texto('ancora')).toBe('nenhuma')
    expect(caixa.current!.previewRef.current.order).toEqual(['card-3'])
  })

  test('sem coluna sob o ponteiro não há vaga nem destino válido', () => {
    iniciar()
    mover({ x: 350, y: -400 })
    expect(texto('coluna')).toBe('nenhuma')
    expect(texto('altura')).toBe('164')
    expect(caixa.current!.validRef.current).toBe(false)
  })

  test('a soltura limpa a prévia e preserva a validade para o assentamento', () => {
    iniciar()
    mover({ x: 350, y: 0 })
    soltar({ x: 350, y: 0 })

    expect(texto('coluna')).toBe('nenhuma')
    expect(texto('arrastando')).toBe('false')
    expect(texto('ativo')).toBe('nenhum')
    expect(caixa.current!.validRef.current).toBe(true)
    expect(caixa.current!.previewRef.current.columnId).toBeNull()
  })

  test('soltura fora das colunas deixa a validade falsa', () => {
    iniciar()
    mover({ x: 350, y: -400 })
    soltar({ x: 350, y: -400 })
    expect(caixa.current!.validRef.current).toBe(false)
    expect(texto('coluna')).toBe('nenhuma')
  })

  test('cancelar volta ao repouso sem sobra de prévia ou validade', () => {
    iniciar()
    mover({ x: 350, y: 0 })
    act(() => { caixa.current!.onDragCancel() })

    expect(texto('coluna')).toBe('nenhuma')
    expect(texto('arrastando')).toBe('false')
    expect(texto('ativo')).toBe('nenhum')
    expect(caixa.current!.validRef.current).toBe(false)
  })

  test('arrastar coluna não passa pela prévia', () => {
    iniciar(150, 350, 'lane:col:todo')
    mover({ x: 350, y: 0 })
    expect(texto('coluna')).toBe('nenhuma')
    expect(texto('ativo')).toBe('nenhum')
    expect(texto('arrastando')).toBe('true')
    expect(caixa.current!.validRef.current).toBe(false)
  })

  test('sem coordenadas do evento ativador a validade não é presumida', () => {
    act(() => {
      caixa.current!.onDragStart({ active: { id: 'card-1' }, activatorEvent: null } as unknown as DragStartEvent)
    })
    mover({ x: 0, y: 0 })
    expect(caixa.current!.validRef.current).toBe(false)
  })
})
