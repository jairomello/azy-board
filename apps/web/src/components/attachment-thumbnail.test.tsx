import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { AttachmentThumbnail } from './AttachmentThumbnail'

beforeEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('AttachmentThumbnail (Card T61)', () => {
  test('mostra o estado de carregamento e depois a imagem', () => {
    render(<AttachmentThumbnail url="/api/projects/p/items/i/attachments/a/download" name="foto.png" mimeType="image/png" />)

    expect(screen.getByText('Carregando miniatura…')).toBeInTheDocument()
    const img = screen.getByAltText('Anexo de imagem foto.png')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('decoding', 'async')

    fireEvent.load(img)
    expect(screen.queryByText('Carregando miniatura…')).not.toBeInTheDocument()
  })

  test('cai para ícone quando a imagem falha', () => {
    render(<AttachmentThumbnail url="/api/x" name="quebrada.png" mimeType="image/png" />)
    fireEvent.error(screen.getByAltText('Anexo de imagem quebrada.png'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('formato não exibível inline (pdf) usa ícone de arquivo', () => {
    render(<AttachmentThumbnail url="/api/x" name="doc.pdf" mimeType="application/pdf" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('imagem não inline (svg) usa ícone, sem executar na origem', () => {
    render(<AttachmentThumbnail url="/api/x" name="vetor.svg" mimeType="image/svg+xml" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('torna-se acionável e dispara onOpen quando fornecido', async () => {
    let opened = 0
    const user = userEvent.setup()
    render(<AttachmentThumbnail url="/api/x" name="foto.jpg" mimeType="image/jpeg" onOpen={() => { opened += 1 }} />)
    await user.click(screen.getByRole('button', { name: 'Abrir imagem foto.jpg' }))
    expect(opened).toBe(1)
  })

  test('sem onOpen não renderiza botão', () => {
    render(<AttachmentThumbnail url="/api/x" name="foto.jpg" mimeType="image/jpeg" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})
