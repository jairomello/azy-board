import { screen } from '../test/setup'
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineEdit } from './InlineEdit'

describe('InlineEdit (edição determinística)', () => {
  test('edita e salva com Enter', async () => {
    const user = userEvent.setup()
    const salvos: string[] = []
    render(<InlineEdit value="Original" onSave={value => salvos.push(value)} placeholder="Título" />)

    await user.click(screen.getByText('Original'))
    const input = screen.getByDisplayValue('Original')
    await user.clear(input)
    await user.type(input, 'Novo título{Enter}')

    expect(salvos).toEqual(['Novo título'])
  })

  test('cancela com Escape preservando o valor original', async () => {
    const user = userEvent.setup()
    const salvos: string[] = []
    render(<InlineEdit value="Original" onSave={value => salvos.push(value)} />)

    await user.click(screen.getByText('Original'))
    await user.type(screen.getByDisplayValue('Original'), 'rascunho{Escape}')

    expect(salvos).toEqual([])
    expect(screen.getByText('Original')).toBeInTheDocument()
  })

  test('não salva valor igual ou vazio', async () => {
    const user = userEvent.setup()
    const salvos: string[] = []
    render(<InlineEdit value="Original" onSave={value => salvos.push(value)} />)

    await user.click(screen.getByText('Original'))
    const input = screen.getByDisplayValue('Original')
    await user.clear(input)
    await user.type(input, '   {Enter}')

    expect(salvos).toEqual([])
  })
})
