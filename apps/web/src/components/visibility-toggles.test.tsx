import { screen } from '../test/setup'
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VisibilityToggles } from './VisibilityToggles'

function renderToggles(overrides: Partial<Parameters<typeof VisibilityToggles>[0]> = {}) {
  const changes: Record<string, boolean> = {}
  const props = {
    restricted: false,
    hidden: false,
    onChangeRestricted: (valor: boolean) => { changes.restricted = valor },
    onChangeHidden: (valor: boolean) => { changes.hidden = valor },
    restrictedLabel: 'Restrito',
    restrictedHint: 'Apenas membros veem',
    hiddenLabel: 'Oculto',
    hiddenHint: 'Não aparece por padrão',
    restrictedId: 'project-restricted',
    hiddenId: 'project-hidden',
    ...overrides,
  }
  render(<VisibilityToggles {...props} />)
  return { changes }
}

describe('VisibilityToggles', () => {
  test('expõe os controles como switches com estado acessível', () => {
    renderToggles({ restricted: true })

    const restricted = screen.getByRole('switch', { name: 'Restrito' })
    const hidden = screen.getByRole('switch', { name: 'Oculto' })

    expect(restricted).toHaveAttribute('aria-checked', 'true')
    expect(hidden).toHaveAttribute('aria-checked', 'false')
  })

  test('inverte o valor do switch de restrito ao clicar', async () => {
    const user = userEvent.setup()
    const { changes } = renderToggles({ restricted: false })

    await user.click(screen.getByRole('switch', { name: 'Restrito' }))

    expect(changes.restricted).toBe(true)
    expect(changes.hidden).toBeUndefined()
  })

  test('desabilita a interação quando disabled é informado', async () => {
    const user = userEvent.setup()
    const { changes } = renderToggles({ disabled: true })

    await user.click(screen.getByRole('switch', { name: 'Oculto' }))

    expect(changes.hidden).toBeUndefined()
    expect(screen.getByRole('switch', { name: 'Oculto' })).toBeDisabled()
  })
})
