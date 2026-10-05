import '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { gravarEmailLembrado, lerEmailLembrado, limparEmailLembrado } from './rememberedEmail'

describe('rememberedEmail (card T31)', () => {
  beforeEach(() => limparEmailLembrado())

  test('grava e lê o e-mail lembrado', () => {
    gravarEmailLembrado('eu@test.local')
    expect(lerEmailLembrado()).toBe('eu@test.local')
  })

  test('sem e-mail lembrado retorna vazio', () => {
    expect(lerEmailLembrado()).toBe('')
  })

  test('limpa o e-mail lembrado', () => {
    gravarEmailLembrado('eu@test.local')
    limparEmailLembrado()
    expect(lerEmailLembrado()).toBe('')
  })
})
