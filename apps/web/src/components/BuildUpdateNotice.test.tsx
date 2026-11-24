import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../i18n'
import { BuildUpdateNotice } from './BuildUpdateNotice'

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
})

afterEach(() => {
  // Restaura o visibilityState alterado por um teste específico.
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

describe('BuildUpdateNotice', () => {
  test('sinaliza build novo e recarrega ao acionar', async () => {
    const user = userEvent.setup()
    let reloads = 0
    const check = async () => ({ version: '2026.11.24.2' })

    render(<BuildUpdateNotice currentVersion="2026.11.24.1" check={check} reload={() => { reloads += 1 }} />)

    const notice = await screen.findByRole('status')
    expect(notice.textContent).toContain('Nova versão disponível (2026.11.24.2)')

    await user.click(screen.getByRole('button', { name: 'Recarregar' }))
    expect(reloads).toBe(1)
  })

  test('não mostra aviso quando a versão publicada é a mesma', async () => {
    const check = async () => ({ version: '2026.11.24.1' })
    render(<BuildUpdateNotice currentVersion="2026.11.24.1" check={check} />)

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  test('não consulta a versão no build de desenvolvimento', async () => {
    let calls = 0
    const check = async () => { calls += 1; return { version: '2026.11.24.2' } }

    render(<BuildUpdateNotice currentVersion="dev" check={check} />)

    await waitFor(() => expect(calls).toBe(0))
  })

  test('permite dispensar o aviso', async () => {
    const user = userEvent.setup()
    const check = async () => ({ version: '2026.11.24.2' })
    render(<BuildUpdateNotice currentVersion="2026.11.24.1" check={check} />)

    await screen.findByRole('status')
    await user.click(screen.getByRole('button', { name: 'Agora não' }))

    expect(screen.queryByRole('status')).toBeNull()
  })

  test('não consulta a versão com a aba oculta', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    let calls = 0
    const check = async () => { calls += 1; return { version: '2026.11.24.2' } }

    render(<BuildUpdateNotice currentVersion="2026.11.24.1" check={check} />)

    await waitFor(() => expect(calls).toBe(0))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
