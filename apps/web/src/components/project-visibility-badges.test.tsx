import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import i18n from '../i18n'
import { ProjectVisibilityBadges } from './ProjectVisibilityBadges'

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('ProjectVisibilityBadges', () => {
  test('não renderiza nada quando não há sinalização', () => {
    const { container } = render(<ProjectVisibilityBadges />)
    expect(container).toBeEmptyDOMElement()
  })

  test('trata sinalizadores ausentes ou falsos como sem sinalização', () => {
    const { container } = render(<ProjectVisibilityBadges isRestricted={false} isHidden={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renderiza restrito e oculto na ordem esperada', () => {
    render(<ProjectVisibilityBadges isRestricted isHidden />)

    const conteudo = document.body.textContent ?? ''
    expect(conteudo).toContain('Restrito')
    expect(conteudo).toContain('Oculto')
    expect(conteudo.indexOf('Restrito')).toBeLessThan(conteudo.indexOf('Oculto'))
  })

  test('exibe tooltip explicativo de cada sinalização', () => {
    render(<ProjectVisibilityBadges isRestricted isHidden />)

    expect(screen.getByText('Somente membros da equipe e o gerente visualizam este projeto')).toBeInTheDocument()
    expect(screen.getByText('Este projeto não aparece na listagem por padrão')).toBeInTheDocument()
  })
})
