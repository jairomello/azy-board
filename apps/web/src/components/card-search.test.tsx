import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { CardSearch } from './CardSearch'
import type { CardSearchItem, CardSearchResult } from '../features/board/model/cardSearch'

interface HarnessProps {
  initialQuery?: string
  results?: CardSearchResult<CardSearchItem>[]
  total?: number
  loading?: boolean
  onSelect?: (item: CardSearchItem) => void
}

function Harness({ initialQuery = '', results = [], total = results.length, loading = false, onSelect = () => {} }: HarnessProps) {
  const [query, setQuery] = useState(initialQuery)
  return (
    <CardSearch
      query={query}
      onQueryChange={setQuery}
      results={results}
      total={total}
      onSelect={onSelect}
      loading={loading}
    />
  )
}

const busca: CardSearchItem = {
  id: 'task-1',
  title: 'Busca de cards no board',
  sequenceCode: 'T92',
  type: 'TASK',
  status: 'IN_PROGRESS',
  ancestryPath: '[{"id":"story-1","title":"Fluxo contínuo","type":"STORY"}]',
  assignee: { name: 'Jairo Silva' },
}

const ajuste: CardSearchItem = {
  id: 'task-2',
  title: 'Ajuste de layout',
  sequenceCode: 'T93',
  type: 'BUG',
  status: 'NOT_STARTED',
}

const results: CardSearchResult<CardSearchItem>[] = [
  { item: busca, score: 1000 },
  { item: ajuste, score: 500 },
]

describe('CardSearch', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  test('digitar mostra o dropdown com código, título, status, responsável e breadcrumb', async () => {
    const user = userEvent.setup()
    render(<Harness results={results} />)
    const input = screen.getByRole('combobox', { name: 'Buscar cards' })
    await user.type(input, 'busca')

    expect(input).toHaveAttribute('aria-expanded', 'true')
    const option = screen.getByRole('option', { name: /Busca de cards no board/ })
    expect(option).toHaveTextContent('T92')
    expect(option).toHaveTextContent('Em andamento')
    expect(option).toHaveTextContent('Fluxo contínuo')
    expect(option).toHaveTextContent('Jairo Silva')
  })

  test('clique em um resultado abre o card', async () => {
    const user = userEvent.setup()
    const selected: CardSearchItem[] = []
    render(<Harness results={results} onSelect={item => selected.push(item)} />)
    await user.type(screen.getByRole('combobox', { name: 'Buscar cards' }), 'busca')
    await user.click(screen.getByRole('option', { name: /Busca de cards no board/ }))
    expect(selected.map(item => item.id)).toEqual(['task-1'])
  })

  test('setas navegam e Enter abre o item ativo', async () => {
    const user = userEvent.setup()
    const selected: CardSearchItem[] = []
    render(<Harness results={results} onSelect={item => selected.push(item)} />)
    const input = screen.getByRole('combobox', { name: 'Buscar cards' })
    await user.type(input, 'busca')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(selected.map(item => item.id)).toEqual(['task-2'])
  })

  test('Escape fecha o dropdown sem limpar a consulta', async () => {
    const user = userEvent.setup()
    render(<Harness results={results} />)
    const input = screen.getByRole('combobox', { name: 'Buscar cards' })
    await user.type(input, 'busca')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('option')).toBeNull()
    expect(input).toHaveValue('busca')
  })

  test('estado vazio mostra a consulta e o botão de limpar', async () => {
    const user = userEvent.setup()
    render(<Harness results={[]} />)
    const input = screen.getByRole('combobox', { name: 'Buscar cards' })
    await user.type(input, 'xilofone')
    expect(screen.getByText('Nenhum card encontrado para “xilofone”')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar busca e mostrar todos os cards' }))
    expect(input).toHaveValue('')
    expect(screen.queryByText(/Nenhum card encontrado/)).toBeNull()
  })

  test('mostra carregando quando a base ainda não chegou', async () => {
    const user = userEvent.setup()
    render(<Harness results={[]} loading />)
    await user.type(screen.getByRole('combobox', { name: 'Buscar cards' }), 'busca')
    expect(screen.getByRole('status')).toHaveTextContent('Carregando cards…')
  })

  test('Ctrl/Cmd+K foca a busca', async () => {
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    try {
      render(<Harness />)
      const input = screen.getByRole('combobox', { name: 'Buscar cards' })
      expect(input).not.toHaveFocus()
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      expect(input).toHaveFocus()
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original })
    }
  })
})
