import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { IconPicker } from './IconPicker'
import { ColorSwatches } from './ColorSwatches'
import { AppearancePicker } from './AppearancePicker'

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('IconPicker', () => {
  test('seleciona um ícone do catálogo', () => {
    const calls: Array<string | null> = []
    render(<IconPicker value={null} onChange={value => calls.push(value)} />)
    fireEvent.click(screen.getByRole('option', { name: 'rocket' }))
    expect(calls).toEqual(['rocket'])
  })

  test('filtra pelo termo de busca', async () => {
    const user = userEvent.setup()
    render(<IconPicker value={null} onChange={() => {}} />)
    await user.type(screen.getByRole('textbox'), 'rock')
    const labels = screen.getAllByRole('option').map((element: HTMLElement) => element.getAttribute('aria-label'))
    expect(labels).toContain('rocket')
    expect(labels).not.toContain('bug')
  })

  test('filtra por categoria usando os chips', () => {
    render(<IconPicker value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tecnologia' }))
    const labels = screen.getAllByRole('option').map((element: HTMLElement) => element.getAttribute('aria-label'))
    expect(labels).toContain('code')
    expect(labels).toContain('git-branch')
    expect(labels).not.toContain('rocket')
  })

  test('combina categoria e busca', async () => {
    const user = userEvent.setup()
    render(<IconPicker value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tecnologia' }))
    await user.type(screen.getByRole('textbox'), 'git')
    const labels = screen.getAllByRole('option').map((element: HTMLElement) => element.getAttribute('aria-label'))
    expect(labels).toContain('git-branch')
    expect(labels).not.toContain('code')
    expect(labels).not.toContain('rocket')
  })

  test('voltar para "Todos" restaura o catálogo completo', async () => {
    render(<IconPicker value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tecnologia' }))
    expect(screen.getAllByRole('option').length).toBeLessThan(60)
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(screen.getAllByRole('option').length).toBeGreaterThan(150)
  })

  test('permite voltar ao ícone padrão', () => {
    const calls: Array<string | null> = []
    render(<IconPicker value="rocket" onChange={value => calls.push(value)} />)
    fireEvent.click(screen.getByRole('option', { name: 'Ícone padrão' }))
    expect(calls).toEqual([null])
  })
})

describe('ColorSwatches', () => {
  test('seleciona uma cor da paleta e a cor padrão do tema', () => {
    const calls: Array<string | null> = []
    render(<ColorSwatches value={null} onChange={value => calls.push(value)} />)
    fireEvent.click(screen.getByRole('button', { name: '#22c55e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cor padrão do tema' }))
    expect(calls).toEqual(['#22c55e', null])
  })
})

describe('AppearancePicker', () => {
  test('abre a galeria e propaga a seleção de ícone mantendo a cor', () => {
    const calls: Array<{ icon: string | null; color: string | null }> = []
    render(<AppearancePicker icon={null} color="#3b82f6" onChange={next => calls.push(next)} />)
    fireEvent.click(screen.getByRole('button', { name: /Aparência/ }))
    fireEvent.click(screen.getByRole('option', { name: 'target' }))
    expect(calls).toEqual([{ icon: 'target', color: '#3b82f6' }])
  })

  test('permite limpar a personalização', () => {
    const calls: Array<{ icon: string | null; color: string | null }> = []
    render(<AppearancePicker icon="rocket" color="#3b82f6" onChange={next => calls.push(next)} />)
    fireEvent.click(screen.getByRole('button', { name: /Aparência/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover personalização' }))
    expect(calls).toEqual([{ icon: null, color: null }])
  })
})
