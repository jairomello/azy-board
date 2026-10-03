import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useItemDescriptionDraft } from '../hooks/useItemDescriptionDraft'
import { readItemDraft, writeItemDraft } from '../lib/itemDraft'

const PROJECT = 'proj-1'
const ITEM = 'item-1'

function Harness({ itemId = ITEM, serverDescription }: { itemId?: string; serverDescription: string | null }) {
  const { description, setDescription, draftRecovered, discardDraft, commitDraft } =
    useItemDescriptionDraft(PROJECT, itemId, serverDescription)
  return (
    <div>
      {draftRecovered && (
        <div role="status">
          <span>rascunho recuperado</span>
          <button type="button" onClick={discardDraft}>descartar</button>
        </div>
      )}
      <textarea aria-label="descricao" value={description} onChange={event => setDescription(event.target.value)} />
      <button type="button" onClick={commitDraft}>salvar</button>
    </div>
  )
}

function textarea(): HTMLTextAreaElement {
  return screen.getByLabelText('descricao') as HTMLTextAreaElement
}

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('rascunho da descrição do item', () => {
  test('restaura rascunho divergente e exibe o aviso', async () => {
    writeItemDraft(PROJECT, ITEM, 'rascunho local', 'servidor')
    render(<Harness serverDescription="servidor" />)
    await waitFor(() => expect(textarea().value).toBe('rascunho local'))
    expect(screen.getByRole('status')).toBeTruthy()
  })

  test('descarta o rascunho e volta ao valor do servidor', async () => {
    writeItemDraft(PROJECT, ITEM, 'rascunho local', 'servidor')
    const user = userEvent.setup()
    render(<Harness serverDescription="servidor" />)
    await user.click(await screen.findByRole('button', { name: 'descartar' }))
    expect(textarea().value).toBe('servidor')
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  test('não mostra aviso e limpa rascunho idêntico ao servidor', () => {
    writeItemDraft(PROJECT, ITEM, 'igual', 'igual')
    render(<Harness serverDescription="igual" />)
    expect(textarea().value).toBe('igual')
    expect(screen.queryByRole('status')).toBeNull()
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
  })

  test('salvar (commitDraft) limpa o rascunho', async () => {
    writeItemDraft(PROJECT, ITEM, 'rascunho local', 'servidor')
    const user = userEvent.setup()
    render(<Harness serverDescription="servidor" />)
    await user.click(await screen.findByRole('button', { name: 'salvar' }))
    expect(readItemDraft(PROJECT, ITEM)).toBeNull()
  })

  test('digitar grava o rascunho após o debounce', async () => {
    const user = userEvent.setup()
    render(<Harness serverDescription="" />)
    await user.type(textarea(), 'novo texto')
    await waitFor(() => expect(readItemDraft(PROJECT, ITEM)?.value).toBe('novo texto'), { timeout: 3000 })
  })

  test('fechar a modal logo após digitar preserva o rascunho', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness serverDescription="" />)
    await user.type(textarea(), 'texto nao salvo')
    unmount()
    expect(readItemDraft(PROJECT, ITEM)?.value).toBe('texto nao salvo')
  })

  test('rascunho permanece quando o salvamento não acontece', () => {
    writeItemDraft(PROJECT, ITEM, 'rascunho local', 'servidor')
    const { unmount } = render(<Harness serverDescription="servidor" />)
    unmount()
    expect(readItemDraft(PROJECT, ITEM)?.value).toBe('rascunho local')
  })

  test('item novo não gera rascunho', async () => {
    const user = userEvent.setup()
    render(<Harness itemId="__new__" serverDescription="" />)
    await user.type(textarea(), 'rascunho de item novo')
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(readItemDraft(PROJECT, '__new__')).toBeNull()
  })
})
