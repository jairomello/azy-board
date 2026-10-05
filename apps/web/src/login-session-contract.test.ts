// [CONTRATO-ESTRUTURAL] wiring de "lembrar-me" e persistência do e-mail (card T31);
// a cobertura comportamental equivalente está em LoginPage.test.tsx e rememberedEmail.test.ts.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato de sessão persistente (card T31)', () => {
  test('AuthContext envia remember no login e grava/limpa o e-mail conforme a escolha', async () => {
    const context = await source('./contexts/AuthContext.tsx')
    expect(context.includes("'/auth/login', { email, password, remember }")).toBe(true)
    expect(context.includes('gravarEmailLembrado(email)')).toBe(true)
    expect(context.includes('limparEmailLembrado()')).toBe(true)
  })

  test('LoginPage pré-preenche o e-mail lembrado e repassa remember', async () => {
    const page = await source('./pages/LoginPage.tsx')
    expect(page.includes('lerEmailLembrado()')).toBe(true)
    expect(page.includes('login(email, password, remember)')).toBe(true)
    expect(page.includes("t('rememberMe')")).toBe(true)
  })

  test('a chave rememberMe existe nos três locales', async () => {
    for (const locale of ['pt-BR', 'en', 'es']) {
      const json = JSON.parse(await source(`./i18n/locales/${locale}/auth.json`)) as Record<string, string>
      expect(`${locale}: ${typeof json.rememberMe === 'string'}`).toBe(`${locale}: true`)
    }
  })
})
