import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

import type { FullItemData, ProjectMember } from './ItemModal'
import type { TaskStatus } from '@azy-board/domain'

const { ItemModal } = await import('./ItemModal')

const fetchOriginal = globalThis.fetch

const ITEM: FullItemData = {
  id: 'i1',
  title: 'Card em homologação',
  status: 'IN_HOMOLOGATION',
  priority: 'MEDIUM',
  type: 'TASK',
  description: 'Descrição do card',
  isLeaf: true,
  ancestryPath: '[]',
}

function membro(): ProjectMember {
  return { userId: 'u1', name: 'Ana', email: 'ana@exemplo.test', role: 'MEMBER' }
}

type Salvar = Parameters<typeof ItemModal>[0]['onSave']

function renderModal(status: TaskStatus, onSave: Salvar = async () => {}) {
  return render(
    <ItemModal
      item={{ ...ITEM, status }}
      projectId="p1"
      epics={[]}
      stories={[]}
      projectTags={[]}
      members={[membro()]}
      currentUserId="u1"
      onClose={() => {}}
      onSave={onSave}
      onAddSubtask={async () => {}}
      onCreateTag={async () => ({ id: 't1', name: 'nova', color: '#ffffff' })}
      onEditTag={async () => {}}
      onCreateStory={async () => ({ id: 's1', title: 'nova história', epicId: 'e1' })}
    />,
  )
}

function campoStatus(): HTMLSelectElement {
  const combos = screen.getAllByRole('combobox') as HTMLElement[]
  const select = combos
    .map((element): HTMLSelectElement => element as HTMLSelectElement)
    .find(element => Array.from(element.options).some(option => option.value === 'IN_HOMOLOGATION'))
  expect(select).toBeTruthy()
  return select!
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  globalThis.fetch = (async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('ItemModal — seletor de status completo', () => {
  test('oferece os sete status editáveis, sem arquivamento', () => {
    renderModal('IN_HOMOLOGATION')
    const status = campoStatus()
    expect(Array.from(status.options).map(option => option.value)).toEqual([
      'NOT_STARTED',
      'PLANNED',
      'IN_PROGRESS',
      'IN_HOMOLOGATION',
      'BLOCKED',
      'DONE',
      'CANCELLED',
    ])
    expect(Array.from(status.options).map(option => option.value)).not.toContain('ARCHIVED')
  })

  test('abre com o status atual selecionado e com o rótulo traduzido', () => {
    renderModal('IN_HOMOLOGATION')
    const status = campoStatus()
    expect(status.value).toBe('IN_HOMOLOGATION')
    expect(status.selectedOptions[0]?.textContent).toBe('Em homologação')
    // O chip do cabeçalho usava um ternário de 5 status e rotulava este como Cancelada.
    expect(screen.getByText('Em homologação', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByText('Cancelada', { selector: 'span' })).toBeNull()
  })

  test('status Planejada também usa o próprio rótulo, nunca Cancelada', () => {
    renderModal('PLANNED')
    const status = campoStatus()
    expect(status.value).toBe('PLANNED')
    expect(status.selectedOptions[0]?.textContent).toBe('Planejada')
    expect(screen.getByText('Planejada', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByText('Cancelada', { selector: 'span' })).toBeNull()
  })

  test('salva o status escolhido para um valor que antes não existia no seletor', async () => {
    const salvos: Array<{ status?: string }> = []
    renderModal('NOT_STARTED', async (_id, dados) => { salvos.push(dados as { status?: string }) })
    await userEvent.selectOptions(campoStatus(), 'IN_HOMOLOGATION')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(salvos).toHaveLength(1))
    expect(salvos[0]?.status).toBe('IN_HOMOLOGATION')
  })
})
