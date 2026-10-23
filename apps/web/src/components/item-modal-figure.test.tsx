import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { configure, render, waitFor } from '@testing-library/react'

// Esperas mais folgadas: a suíte roda em paralelo e o CI tem carga variável.
configure({ asyncUtilTimeout: 5000 })
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

import type { FullItemData, ProjectMember } from './ItemModal'

const { ItemModal } = await import('./ItemModal')

const fetchOriginal = globalThis.fetch

const ITEM: FullItemData = {
  id: 'i1',
  title: 'Card com figura',
  status: 'NOT_STARTED',
  priority: 'MEDIUM',
  type: 'TASK',
  description: 'Descrição do card',
  isLeaf: true,
  ancestryPath: '[]',
}

function membro(role: string): ProjectMember {
  return { userId: 'u1', name: 'Ana', email: 'ana@exemplo.test', role }
}

function renderModal(role: string) {
  return render(
    <ItemModal
      item={ITEM}
      projectId="p1"
      epics={[]}
      stories={[]}
      projectTags={[]}
      members={[membro(role)]}
      currentUserId="u1"
      onClose={() => {}}
      onSave={async () => {}}
      onAddSubtask={async () => {}}
      onCreateTag={async () => ({ id: 't1', name: 'nova', color: '#ffffff' })}
      onEditTag={async () => {}}
      onCreateStory={async () => ({ id: 's1', title: 'nova história', epicId: 'e1' })}
    />,
  )
}

const editorMontado = () => waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull())

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  globalThis.fetch = (async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('ItemModal — contexto de anexos na descrição (Card T87)', () => {
  test('membro que pode anexar recebe a ação de inserir figura', async () => {
    renderModal('MEMBER')
    expect(await screen.findByLabelText('Inserir figura')).toBeInTheDocument()
  })

  test('usuário somente leitura não recebe a ação de inserir figura', async () => {
    renderModal('VIEWER')
    await editorMontado()
    expect(screen.queryByLabelText('Inserir figura')).not.toBeInTheDocument()
  })

  test('item novo não recebe contexto de anexos', async () => {
    render(
      <ItemModal
        item={{ ...ITEM, id: '__new__', description: '' }}
        projectId="p1"
        epics={[]}
        stories={[]}
        projectTags={[]}
        members={[membro('MEMBER')]}
        currentUserId="u1"
        onClose={() => {}}
        onSave={async () => {}}
        onAddSubtask={async () => {}}
        onCreateTag={async () => ({ id: 't1', name: 'nova', color: '#ffffff' })}
        onEditTag={async () => {}}
        onCreateStory={async () => ({ id: 's1', title: 'nova história', epicId: 'e1' })}
      />,
    )
    await editorMontado()
    expect(screen.queryByLabelText('Inserir figura')).not.toBeInTheDocument()
  })
})
