import { screen } from '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import i18n from '../../../i18n'
import { CardDropPlaceholder } from './CardDropPlaceholder'

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('CardDropPlaceholder — vaga de destino (Card T89)', () => {
  test('desenha a caixa tracejada com a altura do card e o rótulo traduzido', () => {
    const { container } = render(<CardDropPlaceholder height={164} index={2} />)
    const vaga = container.querySelector('.kanban-card-placeholder') as HTMLElement

    expect(vaga).not.toBeNull()
    expect(vaga.style.height).toBe('164px')
    expect(vaga.getAttribute('data-preview-index')).toBe('2')
    expect(screen.getByText('Soltar aqui')).not.toBeNull()
  })

  test('é decorativa: nada dentro dela é focável ou clicável', () => {
    const { container } = render(<CardDropPlaceholder height={120} index={0} />)
    const vaga = container.querySelector('.kanban-card-placeholder') as HTMLElement

    expect(vaga.getAttribute('aria-hidden')).toBe('true')
    expect(vaga.querySelectorAll('button, a, input, select, textarea, [tabindex]')).toHaveLength(0)
  })
})
