import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { configure, fireEvent, render } from '@testing-library/react'

// Esperas mais folgadas: a suíte roda em paralelo e o CI tem carga variável.
configure({ asyncUtilTimeout: 5000 })
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

const { AttachmentsArea } = await import('./AttachmentsArea')

const fetchOriginal = globalThis.fetch
const confirmOriginal = globalThis.confirm
let perguntas: string[] = []

const ANEXO = {
  id: 'a1',
  filename: 'grafico.png',
  originalName: 'grafico.png',
  mimeType: 'image/png',
  size: 2048,
  createdAt: '2026-10-01T00:00:00.000Z',
  url: '/api/projects/p/items/i/attachments/a1/download',
  isImage: true,
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  perguntas = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify([ANEXO]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  globalThis.confirm = (mensagem?: string) => { perguntas.push(String(mensagem)); return false }
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
  globalThis.confirm = confirmOriginal
})

describe('AttachmentsArea — aviso de anexo citado na descrição (Card T87)', () => {
  test('avisa antes de excluir um anexo citado como figura', async () => {
    render(<AttachmentsArea itemId="i" projectId="p" canEdit citedAttachmentIds={['a1']} />)
    fireEvent.click(await screen.findByLabelText('Remover anexo'))
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]).toContain('está citada na descrição')
    expect(perguntas[0]).toContain('grafico.png')
  })

  test('não avisa sobre citação quando o anexo não é citado', async () => {
    render(<AttachmentsArea itemId="i" projectId="p" canEdit citedAttachmentIds={[]} />)
    fireEvent.click(await screen.findByLabelText('Remover anexo'))
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]).not.toContain('está citada na descrição')
  })
})
