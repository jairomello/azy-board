import { screen } from '../test/setup'
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from './Toast'

afterEach(() => cleanup())

function Trigger({ onUndo }: { onUndo: () => void }) {
  const { toast } = useToast()
  return (
    <button
      type="button"
      onClick={() => toast('Item arquivado', 'success', {
        durationMs: 7000,
        action: { label: 'Desfazer', onClick: onUndo },
      })}
    >
      arquivar
    </button>
  )
}

describe('Toast — ação de desfazer', () => {
  test('mostra a ação no toast e executa ao clicar', async () => {
    const user = userEvent.setup()
    let undoCalls = 0
    render(<ToastProvider><Trigger onUndo={() => { undoCalls += 1 }} /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'arquivar' }))
    const undo = await screen.findByRole('button', { name: 'Desfazer' })
    await user.click(undo)

    expect(undoCalls).toBe(1)
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
    expect(screen.queryByText('Item arquivado')).not.toBeInTheDocument()
  })

  test('toast sem ação continua sem botão extra', async () => {
    function Simple() {
      const { toast } = useToast()
      return <button type="button" onClick={() => toast('Item restaurado')}>restaurar</button>
    }
    const user = userEvent.setup()
    render(<ToastProvider><Simple /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'restaurar' }))
    await screen.findByText('Item restaurado')
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
  })

  test('toast sem ação some sozinho depois da duração configurada', async () => {
    function Short() {
      const { toast } = useToast()
      return <button type="button" onClick={() => toast('Some rápido', 'success', { durationMs: 30 })}>curto</button>
    }
    const user = userEvent.setup()
    render(<ToastProvider><Short /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'curto' }))
    await screen.findByText('Some rápido')
    await waitFor(() => expect(screen.queryByText('Some rápido')).not.toBeInTheDocument(), { timeout: 1500 })
  })
})
