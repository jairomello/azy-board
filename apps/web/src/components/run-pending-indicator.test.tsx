import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import i18n from '../i18n'
import { RunPendingIndicator } from './RunPendingIndicator'

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('RunPendingIndicator', () => {
  test('exibe rótulo localizado com indicador animado enquanto aguarda a resposta', () => {
    const { container } = render(<RunPendingIndicator />)
    expect(screen.getByRole('status')).toHaveTextContent('Pensando...')
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })
})
