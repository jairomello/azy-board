import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import i18n from '../../../i18n'
import { UnifiedBoard } from './UnifiedBoard'
import type { Column, ItemData } from '../model/types'

const columns: Column[] = [
  { id: 'todo', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
  { id: 'doing', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1, progressWeight: 50, progressWeightOverride: null },
]

const storyA = JSON.stringify([{ id: 'epic-a', title: 'Épico A', type: 'EPIC' }, { id: 'story-a', title: 'História A', type: 'STORY' }])
const storyB = JSON.stringify([{ id: 'epic-b', title: 'Épico B', type: 'EPIC' }, { id: 'story-b', title: 'História B', type: 'STORY' }])

const cards: ItemData[] = [
  { id: 'task-a', type: 'TASK', title: 'Card do épico A', ancestryPath: storyA, status: 'NOT_STARTED', columnId: 'todo', isLeaf: true, position: 0, sequenceCode: 'A-1' },
  { id: 'task-b', type: 'BUG', title: 'Card do épico B', ancestryPath: storyB, status: 'IN_PROGRESS', columnId: 'doing', isLeaf: true, position: 0, sequenceCode: 'B-1' },
] as ItemData[]

function renderBoard(overrides: Partial<Parameters<typeof UnifiedBoard>[0]> = {}) {
  const quickAdds: string[] = []
  render(
    <DndContext>
      <UnifiedBoard
        cards={cards}
        columns={columns}
        versions={[]}
        sprints={[]}
        onQuickAdd={columnId => quickAdds.push(columnId)}
        onOpenDetail={() => {}}
        onTitleSave={() => {}}
        onDelete={() => {}}
        onArchive={() => {}}
        {...overrides}
      />
    </DndContext>,
  )
  return { quickAdds }
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('UnifiedBoard — uma única faixa de colunas', () => {
  test('mostra cards de épicos diferentes no mesmo quadro, sem cabeçalho de módulo ou épico', () => {
    renderBoard()
    expect(screen.getByText('Card do épico A')).toBeInTheDocument()
    expect(screen.getByText('Card do épico B')).toBeInTheDocument()
    expect(screen.queryByText('Épico A')).not.toBeInTheDocument()
    expect(screen.queryByText('História A')).not.toBeInTheDocument()
  })

  test('distribui os cards pelas colunas do fluxo com um único conjunto de colunas', () => {
    renderBoard()
    const colunas = Array.from(document.querySelectorAll('[data-drop-id]'))
      .map(element => element.getAttribute('data-drop-id'))
    expect(colunas).toEqual(['unified:col:todo', 'unified:col:doing'])
  })

  test('conta o recorte atual no cabeçalho', () => {
    renderBoard()
    expect(document.querySelector('[data-unified-count]')?.getAttribute('data-unified-count')).toBe('2')
  })

  test('o adicionar card da coluna abre a criação contextual daquela coluna', async () => {
    const { quickAdds } = renderBoard()
    const botoes = screen.getAllByRole('button', { name: 'Adicionar card' })
    await userEvent.click(botoes[1]!)
    expect(quickAdds).toEqual(['doing'])
  })

  test('recorte vazio mantém as colunas e explica o estado', () => {
    renderBoard({ cards: [] })
    expect(screen.getByText(/Nenhum card neste recorte|Ajuste os filtros/)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-drop-id]').length).toBe(2)
  })
})
