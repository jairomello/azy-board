import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const state: { result: boolean; copied: string[] } = { result: true, copied: [] }

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../lib/clipboard', () => ({
  copyTextToClipboard: async (text: string) => {
    state.copied.push(text)
    return state.result
  },
}))

const { McpConnectionGuide } = await import('./McpConnectionGuide')

const globalWithWindow = globalThis as unknown as { window: Window & { __BASE_PATH__?: string } }

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  state.result = true
  state.copied = []
  delete globalWithWindow.window.__BASE_PATH__
})

describe('McpConnectionGuide — orientação de conexão do MCP', () => {
  test('explica a finalidade da chave e exibe a URL do MCP da instalação', () => {
    render(<McpConnectionGuide />)
    expect(screen.getByText('Sua API Key conecta seu code agent ao MCP do Azy Board.')).toBeInTheDocument()
    const url = screen.getByText('http://localhost/mcp')
    expect(url.tagName).toBe('CODE')
  })

  test('reflete o base path na URL exibida', () => {
    globalWithWindow.window.__BASE_PATH__ = '/azyboard/'
    render(<McpConnectionGuide />)
    expect(screen.getByText('http://localhost/azyboard/mcp')).toBeInTheDocument()
  })

  test('copia a URL do MCP com confirmação visual', async () => {
    const user = userEvent.setup()
    render(<McpConnectionGuide />)
    await user.click(screen.getByRole('button', { name: /Copiar URL/ }))
    expect(state.copied).toEqual(['http://localhost/mcp'])
    expect(await screen.findByRole('button', { name: /URL copiada/ })).toBeInTheDocument()
  })

  test('copia a instrução com a URL e sem valor de chave', async () => {
    const user = userEvent.setup()
    render(<McpConnectionGuide />)
    await user.click(screen.getByRole('button', { name: /Copiar instrução para o agente/ }))
    expect(state.copied).toHaveLength(1)
    expect(state.copied[0]).toContain('http://localhost/mcp')
    expect(state.copied[0]).toContain('azyboard')
    expect(state.copied[0]?.includes('azb_')).toBe(false)
    expect(await screen.findByRole('button', { name: /Instrução copiada/ })).toBeInTheDocument()
  })

  test('na falha do clipboard mantém a URL visível e comunica o erro', async () => {
    const user = userEvent.setup()
    state.result = false
    render(<McpConnectionGuide />)
    await user.click(screen.getByRole('button', { name: /Copiar URL/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível copiar automaticamente.')
    expect(screen.getByText('http://localhost/mcp')).toBeInTheDocument()
    expect(screen.queryByText(/URL copiada/)).toBeNull()
  })

  test('não expõe nenhum valor de chave na orientação', () => {
    render(<McpConnectionGuide />)
    expect(screen.queryByText(/azb_/)).toBeNull()
  })

  test('exibe a dica de usar a skill com o comando oficial', () => {
    render(<McpConnectionGuide />)
    const dica = screen.getByText(/skill azyboard/)
    expect(dica.textContent).toContain('azyboard')
    expect(dica.textContent).toContain('/azyboard-setup-mcp')
    expect(dica.textContent).toContain('conduz a configuração do MCP')
  })

  test('a dica não pede nem mostra chave', () => {
    render(<McpConnectionGuide />)
    const dica = screen.getByText(/skill azyboard/)
    expect(dica.textContent?.includes('azb_')).toBe(false)
    expect(dica.textContent?.toLowerCase().includes('chave no chat')).toBe(false)
  })

  test('traduz a dica para en mantendo o comando', async () => {
    await i18n.changeLanguage('en')
    render(<McpConnectionGuide />)
    const dica = screen.getByText(/azyboard skill/)
    expect(dica.textContent).toContain('/azyboard-setup-mcp')
    expect(dica.textContent).toContain('walk you through')
  })

  test('traduz a dica para es mantendo o comando', async () => {
    await i18n.changeLanguage('es')
    render(<McpConnectionGuide />)
    const dica = screen.getByText(/skill azyboard/)
    expect(dica.textContent).toContain('/azyboard-setup-mcp')
    expect(dica.textContent).toContain('te guía')
  })
})
