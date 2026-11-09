import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import ptExport from '../i18n/locales/pt-BR/export.json'
import enExport from '../i18n/locales/en/export.json'
import esExport from '../i18n/locales/es/export.json'
import { ExportDialog } from './ExportDialog'

const fetchOriginal = globalThis.fetch
const calls: Array<{ method: string; path: string; body?: unknown }> = []

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(async () => {
  calls.length = 0
  i18n.addResourceBundle('pt-BR', 'export', ptExport, true, true)
  i18n.addResourceBundle('en', 'export', enExport, true, true)
  i18n.addResourceBundle('es', 'export', esExport, true, true)
  await i18n.changeLanguage('pt-BR')
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    let body: unknown
    if (typeof init?.body === 'string') body = JSON.parse(init.body)
    calls.push({ method, path, body })
    if (method === 'GET' && path.endsWith('/export-mappings')) return jsonResponse([])
    if (method === 'POST' && path.endsWith('/export-mappings')) {
      return jsonResponse({ id: 'map-1', name: 'CRM', fields: [{ source: 'title', target: 'title' }], createdAt: '2026-01-01', updatedAt: '2026-01-01' }, 201)
    }
    return jsonResponse({ error: 'not found' }, 404)
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
  cleanup()
})

describe('ExportDialog', () => {
  test('monta o mapeamento por clique, conta os campos e limpa os vínculos', async () => {
    render(<ExportDialog projectId="p1" filters={{}} onClose={() => {}} />)
    await screen.findByText('Exportar dados')

    fireEvent.click(screen.getByRole('button', { name: 'Dinâmico' }))
    await screen.findByText('Origem (esquerda)')

    expect(screen.getByText('0 de 4 campos mapeados')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mapear Título' }))

    expect(screen.getByText('1 de 4 campos mapeados')).toBeTruthy()
    const targetInputs = screen.getAllByLabelText('Nome da coluna') as HTMLInputElement[]
    expect(targetInputs[0]!.value).toBe('title')

    fireEvent.click(screen.getByRole('button', { name: 'Limpar mapeamento' }))
    expect(screen.getByText('0 de 4 campos mapeados')).toBeTruthy()
  })

  test('salva o mapeamento nomeado respeitando os campos vinculados', async () => {
    render(<ExportDialog projectId="p1" filters={{ moduleId: 'm1' }} onClose={() => {}} />)
    await screen.findByText('Exportar dados')
    fireEvent.click(screen.getByRole('button', { name: 'Dinâmico' }))
    await screen.findByText('Origem (esquerda)')
    fireEvent.click(screen.getByRole('button', { name: 'Mapear Título' }))
    fireEvent.change(screen.getByLabelText('Tipo do campo'), { target: { value: 'number' } })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nome do mapeamento'), 'CRM')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.some(call => call.method === 'POST' && call.path.endsWith('/export-mappings'))).toBe(true))
    const save = calls.find(call => call.method === 'POST' && call.path.endsWith('/export-mappings'))!
    expect(save.body).toEqual({ name: 'CRM', fields: [{ source: 'title', target: 'title', type: 'number' }] })
    await screen.findByText('Mapeamento salvo.')
  })
})
