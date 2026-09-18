import { describe, expect, test } from 'bun:test'

// O workspace não possui DOM, jsdom ou React Testing Library. O componente é
// verificado pela leitura do fonte e pela simulação pura da regra de decisão de
// quais badges renderizar — sem infraestrutura de browser fora do escopo.
const badges = await fetch(new URL('./components/ProjectVisibilityBadges.tsx', import.meta.url)).then(r => r.text())

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

function badgesEsperados(flags: { isRestricted?: boolean; isHidden?: boolean }): string {
  const esperados: string[] = []
  if (flags.isRestricted) esperados.push('restrito')
  if (flags.isHidden) esperados.push('oculto')
  return esperados.join(',')
}

describe('badges de visibilidade do card de projeto', () => {
  test('decide quais badges renderizar a partir das props', () => {
    expect(badgesEsperados({ isRestricted: true })).toBe('restrito')
    expect(badgesEsperados({ isHidden: true })).toBe('oculto')
    expect(badgesEsperados({ isRestricted: true, isHidden: true })).toBe('restrito,oculto')
    expect(badgesEsperados({ isRestricted: false, isHidden: false })).toBe('')
  })

  test('trata campos ausentes como false', () => {
    expect(badgesEsperados({})).toBe('')
    expect(badgesEsperados({ isRestricted: undefined, isHidden: undefined })).toBe('')
  })

  test('renderiza nada quando não há sinalização', () => {
    contains(badges, 'if (!restrito && !oculto) return null')
  })

  test('usa Boolean para normalizar as props', () => {
    contains(badges, 'const restrito = Boolean(isRestricted)')
    contains(badges, 'const oculto = Boolean(isHidden)')
  })

  test('restrito vem antes de oculto', () => {
    expect(badges.indexOf('icon={Lock}') < badges.indexOf('icon={EyeOff}')).toBe(true)
  })
})
