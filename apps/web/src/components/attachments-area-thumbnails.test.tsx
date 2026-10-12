import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

const { AttachmentsArea } = await import('./AttachmentsArea')

const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  globalThis.fetch = (async () => jsonResponse([
    { id: 'a1', filename: 'foto.png', originalName: 'foto.png', mimeType: 'image/png', size: 2048, createdAt: '2026-10-01T00:00:00.000Z', url: '/api/projects/p/items/i/attachments/a1/download', isImage: true },
    { id: 'a2', filename: 'doc.pdf', originalName: 'doc.pdf', mimeType: 'application/pdf', size: 1024, createdAt: '2026-10-01T00:00:00.000Z', url: '/api/projects/p/items/i/attachments/a2/download', isImage: false },
  ])) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('AttachmentsArea — miniaturas (Card T61)', () => {
  test('mostra miniatura para imagem e ícone para formato não exibível', async () => {
    render(<AttachmentsArea itemId="item-1" projectId="project-1" canEdit={false} />)

    const thumb = await screen.findByAltText('Anexo de imagem foto.png')
    expect(thumb).toBeInTheDocument()
    // Apenas o anexo de imagem vira <img>; o PDF permanece como ícone.
    expect(screen.queryByAltText('Anexo de imagem doc.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
  })
})
