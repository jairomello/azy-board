import type { ReactNode } from 'react'
import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { AppErrorBoundary } from './AppErrorBoundary'

let consoleError: typeof console.error

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  consoleError = console.error
  console.error = () => {}
})

afterEach(() => {
  console.error = consoleError
})

function Explosao({ mensagem }: { mensagem: string }): ReactNode {
  throw new Error(mensagem)
}

describe('AppErrorBoundary', () => {
  test('renderiza os filhos quando não há erro', () => {
    render(<AppErrorBoundary><span>conteúdo</span></AppErrorBoundary>)
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })

  test('exibe alerta com mensagem genérica e referência em produção', () => {
    render(<AppErrorBoundary isProduction><Explosao mensagem="segredo interno" /></AppErrorBoundary>)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('segredo interno')).toBeNull()
  })

  test('mostra a mensagem do erro fora de produção', () => {
    render(<AppErrorBoundary isProduction={false}><Explosao mensagem="falha local" /></AppErrorBoundary>)

    expect(screen.getByText('falha local')).toBeInTheDocument()
  })

  test('recupera os filhos ao tentar novamente', async () => {
    const user = userEvent.setup()
    let deveExplodir = true
    function Instavel() {
      if (deveExplodir) throw new Error('boom')
      return <span>recuperado</span>
    }

    render(<AppErrorBoundary isProduction={false}><Instavel /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    deveExplodir = false
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    expect(screen.getByText('recuperado')).toBeInTheDocument()
  })
})
