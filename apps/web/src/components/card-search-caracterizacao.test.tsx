// Teste de caracterização da busca de cards do cabeçalho (CardSearch), rede de
// segurança antes dos atalhos de teclado globais. Prende o comportamento ATUAL
// (A6-02): Tab no campo fecha o dropdown de resultados, sem abrir o item ativo e
// sem limpar a consulta.
import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { CardSearch } from './CardSearch'
import type { CardSearchItem, CardSearchResult } from '../features/board/model/cardSearch'

const itens: CardSearchItem[] = [
  { id: 'task-1', title: 'Busca de cards no board', sequenceCode: 'T92', type: 'TASK', status: 'IN_PROGRESS' },
  { id: 'task-2', title: 'Busca avançada', sequenceCode: 'T93', type: 'BUG', status: 'NOT_STARTED' },
]
const resultados: CardSearchResult<CardSearchItem>[] = itens.map((item, indice) => ({ item, score: 1000 - indice }))

function Harness({ onSelect }: { onSelect: (item: CardSearchItem) => void }) {
  const [query, setQuery] = useState('')
  return (
    <>
      <CardSearch query={query} onQueryChange={setQuery} results={resultados} total={resultados.length} onSelect={onSelect} />
      <button type="button">depois da busca</button>
    </>
  )
}

function montar() {
  const selecionados: string[] = []
  render(<Harness onSelect={item => selecionados.push(item.id)} />)
  return { selecionados, campo: screen.getByRole('combobox', { name: 'Buscar cards' }) }
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('CardSearch — Tab fecha o dropdown (A6-02)', () => {
  test('keydown Tab no campo fecha o dropdown sem abrir o item ativo e sem limpar a consulta', async () => {
    const user = userEvent.setup()
    const { selecionados, campo } = montar()
    await user.type(campo, 'busca')
    expect(campo).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(2)

    fireEvent.keyDown(campo, { key: 'ArrowDown' })
    fireEvent.keyDown(campo, { key: 'Tab' })

    expect(screen.queryByRole('option')).toBeNull()
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    expect(campo).toHaveValue('busca')
    expect(selecionados).toEqual([])
  })

  test('Tab do teclado (userEvent) fecha o dropdown e leva o foco ao próximo controle', async () => {
    const user = userEvent.setup()
    const { selecionados, campo } = montar()
    await user.type(campo, 'busca')
    expect(screen.getAllByRole('option')).toHaveLength(2)

    await user.tab()

    expect(screen.queryByRole('option')).toBeNull()
    expect(campo).toHaveAttribute('aria-expanded', 'false')
    expect(campo).toHaveValue('busca')
    expect(selecionados).toEqual([])
    expect(campo).not.toHaveFocus()
  })
})
