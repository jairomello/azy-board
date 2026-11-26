import { screen } from '../../../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../../../i18n'

// Teste de caracterização (P0 — rede de segurança do redesenho de Configurações).
// A seção de Integrações fala direto com a API (não recebe handlers do Screen):
// carrega a configuração do Teams, salva via PUT e remove via DELETE com confirm().

type Chamada = { metodo: string; caminho: string; corpo?: unknown }
const estado: { chamadas: Chamada[]; config: Record<string, unknown> } = { chamadas: [], config: {} }

class MockApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../../../lib/api', () => ({
  ApiError: MockApiError,
  api: {
    get: async (caminho: string) => {
      estado.chamadas.push({ metodo: 'GET', caminho })
      if (caminho.endsWith('/integrations/teams')) return estado.config
      return { data: [{ id: 'st1', title: 'História de entrada', sequenceCode: 'H1' }] }
    },
    put: async (caminho: string, corpo: unknown) => {
      estado.chamadas.push({ metodo: 'PUT', caminho, corpo })
      return { ...estado.config, configured: true, url: 'https://azy.test/hooks/teams/abc' }
    },
    delete: async (caminho: string) => { estado.chamadas.push({ metodo: 'DELETE', caminho }); return undefined },
  },
}))

const { IntegrationSettingsSections } = await import('./IntegrationSettingsSections')

const modulos = [{ id: 'm1', name: 'Financeiro', position: 0 }]
const confirmOriginal = globalThis.confirm
let respostaConfirm = true
let confirmacoes: string[] = []

function renderSecao(isAdmin = true) {
  return render(<IntegrationSettingsSections projectId="p-1" modules={modulos} isAdmin={isAdmin} openSections={new Set(['integrations'])} onToggleSection={() => {}} />)
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  estado.chamadas = []
  estado.config = { enabled: true, configured: false, url: null, moduleId: null, parentItemId: null, defaultType: 'TASK', messages: [] }
  confirmacoes = []
  respostaConfirm = true
  globalThis.confirm = ((mensagem?: string) => { confirmacoes.push(String(mensagem)); return respostaConfirm }) as typeof confirm
})

afterEach(() => { globalThis.confirm = confirmOriginal })

describe('IntegrationSettingsSections — Teams', () => {
  test('carrega a configuração e as histórias do projeto ao montar', async () => {
    renderSecao()
    await waitFor(() => expect(estado.chamadas.map(chamada => chamada.caminho)).toEqual([
      '/projects/p-1/integrations/teams',
      '/projects/p-1/items?type=STORY&limit=100',
    ]))
    expect(screen.getByRole('region', { name: 'Integrações' })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'H1 — História de entrada' })).toBeInTheDocument()
  })

  test('salvar envia PUT com token, módulo, história, tipo padrão e ativo', async () => {
    const user = userEvent.setup()
    const { container } = renderSecao()
    const secao = screen.getByRole('region', { name: 'Integrações' })
    await screen.findByRole('option', { name: 'H1 — História de entrada' })

    await user.type(container.querySelector('input[type="password"]') as HTMLElement, '  segredo-123  ')
    const [modulo, historia] = within(secao).getAllByRole('combobox')
    await user.selectOptions(modulo!, 'm1')
    await user.selectOptions(historia!, 'st1')
    await user.click(within(secao).getByRole('checkbox', { name: 'Integração ativa' }))
    await user.click(within(secao).getByRole('button', { name: 'Salvar integração' }))

    await waitFor(() => expect(estado.chamadas.filter(chamada => chamada.metodo === 'PUT')).toEqual([{
      metodo: 'PUT',
      caminho: '/projects/p-1/integrations/teams',
      corpo: { teamsSecret: 'segredo-123', moduleId: 'm1', parentItemId: 'st1', defaultType: 'TASK', enabled: false },
    }]))
    expect(await within(secao).findByRole('status')).toHaveTextContent('Integração salva.')
    // Depois de salvo aparece a URL do webhook.
    expect(within(secao).getByDisplayValue('https://azy.test/hooks/teams/abc')).toBeInTheDocument()
  })

  test('remover pede confirmação e só chama DELETE se confirmado', async () => {
    estado.config = { ...estado.config, configured: true, url: 'https://azy.test/hooks/teams/abc' }
    const user = userEvent.setup()
    renderSecao()
    const secao = screen.getByRole('region', { name: 'Integrações' })
    const remover = await within(secao).findByRole('button', { name: 'Remover' })

    respostaConfirm = false
    await user.click(remover)
    expect(confirmacoes).toEqual(['Remover a integração do Teams? A URL deixa de funcionar.'])
    expect(estado.chamadas.some(chamada => chamada.metodo === 'DELETE')).toBe(false)

    respostaConfirm = true
    await user.click(remover)
    await waitFor(() => expect(estado.chamadas.filter(chamada => chamada.metodo === 'DELETE')).toEqual([{ metodo: 'DELETE', caminho: '/projects/p-1/integrations/teams' }]))
  })

  test('sem admin não há token, seletores nem botão de salvar (A8-05)', async () => {
    renderSecao(false)
    const secao = screen.getByRole('region', { name: 'Integrações' })
    await waitFor(() => expect(estado.chamadas.length).toBeGreaterThan(0))
    expect(within(secao).queryByRole('button', { name: 'Salvar integração' })).toBeNull()
    expect(within(secao).queryAllByRole('combobox')).toHaveLength(0)
    expect(secao.querySelector('input[type="password"]')).toBeNull()
    expect(within(secao).getByText('Nenhuma mensagem recebida ainda.', { exact: false })).toBeInTheDocument()
  })
})

describe('IntegrationSettingsSections — URL do MCP do projeto', () => {
  test('exibe e copia a URL do MCP do projeto, também para não admin', async () => {
    // O userEvent.setup() instala uma área de transferência própria no navigator.
    const user = userEvent.setup()
    renderSecao(false)
    const secao = screen.getByRole('region', { name: 'Integrações' })
    const url = within(secao).getByText('http://localhost/mcp/projects/p-1')
    expect(url.tagName).toBe('CODE')
    await user.click(within(secao).getByRole('button', { name: 'Copiar URL do MCP' }))
    expect(await within(secao).findByRole('button', { name: 'URL copiada' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('http://localhost/mcp/projects/p-1')
  })
})
