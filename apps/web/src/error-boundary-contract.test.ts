import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('contrato do boundary de erro do app', () => {
  test('App.tsx delega ao boundary extraído e não expõe stack nem texto fixo', async () => {
    const app = await source('./App.tsx')
    contains(app, "import { AppErrorBoundary } from './components/AppErrorBoundary'")
    contains(app, '<AppErrorBoundary>')
    expect(app.includes('err.stack')).toBe(false)
    expect(app.includes('Tentar novamente')).toBe(false)
    expect(app.includes('class ErrorBoundary')).toBe(false)
  })

  test('o boundary usa mensagem genérica e só mostra detalhes quando permitido', async () => {
    const boundary = await source('./components/AppErrorBoundary.tsx')
    contains(boundary, 'role="alert"')
    contains(boundary, 'import.meta.env.PROD')
    contains(boundary, 'describeRenderError(error, this.isProduction)')
    contains(boundary, 'details.showDetails')
    contains(boundary, "i18n.t('renderErrorGeneric')")
    contains(boundary, "i18n.t('renderErrorReference'")
    // Nunca acessa a mensagem/stack do erro diretamente no render
    expect(boundary.includes('error.stack')).toBe(false)
    expect(boundary.includes('error.message')).toBe(false)
  })

  test('gera a referência por ocorrência e registra na observabilidade', async () => {
    const boundary = await source('./components/AppErrorBoundary.tsx')
    contains(boundary, 'getDerivedStateFromError')
    contains(boundary, 'createErrorReference()')
    contains(boundary, 'reportRenderError')
    contains(boundary, 'componentStack')

    const util = await source('./lib/renderError.ts')
    contains(util, 'export function createErrorReference')
    contains(util, 'export function describeRenderError')
    contains(util, 'export function reportRenderError')
  })
})
