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

function ChunkQuebrado(): ReactNode {
  throw new Error('Failed to fetch dynamically imported module: https://azyboard/assets/BoardPage-abc.js')
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

  test('falha de chunk vira aviso de build desatualizado e tenta recarga única', () => {
    let recoveries = 0

    render(
      <AppErrorBoundary
        isProduction
        recoverStaleBuild={() => { recoveries += 1; return false }}
      >
        <ChunkQuebrado />
      </AppErrorBoundary>,
    )

    expect(screen.getByText('Versão desatualizada')).toBeInTheDocument()
    expect(screen.queryByText('Erro de renderização')).toBeNull()
    expect(recoveries).toBe(1)
  })

  test('quando a trava bloqueia a recarga, o botão recarrega a página de verdade', async () => {
    const user = userEvent.setup()
    let reloads = 0

    render(
      <AppErrorBoundary
        isProduction
        recoverStaleBuild={() => false}
        reloadPage={() => { reloads += 1 }}
      >
        <ChunkQuebrado />
      </AppErrorBoundary>,
    )

    await user.click(screen.getByRole('button', { name: /recarregar página/i }))
    expect(reloads).toBe(1)
  })

  test('erro comum não dispara recarga automática', () => {
    let recoveries = 0

    render(
      <AppErrorBoundary
        isProduction
        recoverStaleBuild={() => { recoveries += 1; return true }}
      >
        <Explosao mensagem="falha local" />
      </AppErrorBoundary>,
    )

    expect(recoveries).toBe(0)
    expect(screen.getByText('Erro de renderização')).toBeInTheDocument()
  })
})
