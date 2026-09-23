import '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { gravarMostrarProjetosOcultos, lerMostrarProjetosOcultos } from './sessionPreferences'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('preferência de sessão "mostrar projetos ocultos"', () => {
  test('começa desligada quando não há valor gravado', () => {
    expect(lerMostrarProjetosOcultos()).toBe(false)
  })

  test('persiste e lê o valor ligado', () => {
    gravarMostrarProjetosOcultos(true)
    expect(lerMostrarProjetosOcultos()).toBe(true)
  })

  test('volta a desligar quando gravada como false', () => {
    gravarMostrarProjetosOcultos(true)
    gravarMostrarProjetosOcultos(false)
    expect(lerMostrarProjetosOcultos()).toBe(false)
  })

  test('nunca usa localStorage, apenas sessionStorage', () => {
    gravarMostrarProjetosOcultos(true)
    expect(localStorage.getItem('show-hidden-projects')).toBeNull()
    expect(sessionStorage.getItem('show-hidden-projects')).toBe('true')
  })
})
