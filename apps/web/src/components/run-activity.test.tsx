import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import i18n from '../i18n'
import { RunActivity } from './RunActivity'

const runningRun = {
  id: 'run-1',
  status: 'RUNNING',
  model: 'gpt-4o-mini',
  tools: [
    { toolName: 'list_tasks', displayName: 'Listar cards', status: 'COMPLETED' },
    { toolName: 'update_item', displayName: 'Editar card', status: 'RUNNING' },
  ],
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('RunActivity — accordion de execução (Card T55)', () => {
  test('inicia recolhido com loader ativo e revela modelo e etapas ao expandir', () => {
    const { container } = render(<RunActivity run={runningRun} />)
    expect(screen.getByRole('button', { name: 'Processando...' })).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.queryByText('gpt-4o-mini')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Processando...' }))
    expect(screen.getByRole('button', { name: 'Processando...' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.getByText('Listar cards')).toBeInTheDocument()
    expect(screen.getByText('Editar card')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  test('para a animação em estado terminal e mantém as etapas disponíveis', () => {
    const finished = { ...runningRun, status: 'COMPLETED' }
    const { container } = render(<RunActivity run={finished} />)
    expect(container.querySelector('.animate-spin')).toBeNull()
    const header = screen.getByRole('button', { name: 'Atividade da execução' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(header)
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
  })

  test('não renderiza nada quando não há modelo nem etapas', () => {
    const { container } = render(<RunActivity run={{ id: 'run-2', status: 'QUEUED' }} />)
    expect(container.firstChild).toBeNull()
  })
})
