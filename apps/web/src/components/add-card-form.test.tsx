import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { AddCardForm } from './AddCardForm'

const t = (key: string) => i18n.t(key, { ns: 'board' })

describe('AddCardForm (DOM por papel/rótulo)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  test('cria o card pelo botão acessível', async () => {
    const user = userEvent.setup()
    const criados: Array<{ title: string; type: string }> = []
    render(<AddCardForm onAdd={async (title, type) => { criados.push({ title, type }) }} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText(t('formTitlePlaceholder')), 'Nova tarefa')
    await user.click(screen.getByRole('button', { name: t('add') }))

    expect(criados).toEqual([{ title: 'Nova tarefa', type: 'TASK' }])
  })

  test('envia com Enter e cancela com Escape', async () => {
    const user = userEvent.setup()
    const criados: string[] = []
    let cancelamentos = 0
    render(<AddCardForm onAdd={async title => { criados.push(title) }} onCancel={() => { cancelamentos += 1 }} />)

    const input = screen.getByPlaceholderText(t('formTitlePlaceholder'))
    await user.type(input, 'Via teclado{Enter}')
    await user.type(input, '{Escape}')

    expect(criados).toEqual(['Via teclado'])
    expect(cancelamentos).toBe(1)
  })

  test('mantém o botão desabilitado sem título', () => {
    render(<AddCardForm onAdd={async () => {}} onCancel={() => {}} />)

    expect(screen.getByRole('button', { name: t('add') })).toBeDisabled()
  })
})
