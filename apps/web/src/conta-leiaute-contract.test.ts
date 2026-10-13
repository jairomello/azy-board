// [CONTRATO-ESTRUTURAL] ordem das seções da página de conta; a ordem do JSX não é
// observável em teste de comportamento (não há DOM/layout neste ambiente e a página
// depende de sessão, provedor e requisições). A cobertura comportamental equivalente
// deve migrar para teste de componente/E2E quando houver harness de página.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato de leiaute da página de conta', () => {
  test('mantém a senha logo após o bloco de identidade, antes de aparência', async () => {
    const page = await source('./pages/AccountPage.tsx')

    const identidade = page.indexOf('<ProfilePhotoSection />')
    const senha = page.indexOf('<PasswordSection />')
    const aparencia = page.indexOf("t('appearance')")
    const visibilidade = page.indexOf('<ShowHiddenProjectsSwitch />')
    const chaves = page.indexOf('<ApiKeysSection />')

    for (const [nome, posicao] of [['perfil', identidade], ['senha', senha], ['aparência', aparencia], ['visibilidade', visibilidade], ['chaves', chaves]] as const) {
      expect(`${nome}:${posicao >= 0}`).toBe(`${nome}:true`)
    }

    expect(identidade).toBeLessThan(senha)
    expect(senha).toBeLessThan(aparencia)
    expect(aparencia).toBeLessThan(visibilidade)
    expect(visibilidade).toBeLessThan(chaves)
  })

  test('a senha é renderizada uma única vez na página', async () => {
    const page = await source('./pages/AccountPage.tsx')
    expect(page.split('<PasswordSection />').length - 1).toBe(1)
  })
})
