import { screen } from '../../../test/setup'
import { useState } from 'react'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../../i18n'
import { BoardModals } from './BoardModals'

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, { ns: 'board', ...options })

const baseProps = {
  projectId: 'project-1',
  item: null,
  newItem: null,
  story: undefined,
  epic: undefined,
  moduleOpen: false,
  moduleName: '',
  moduleDescription: '',
  archiveConfirm: null,
  archivedOpen: false,
  archivedItems: [],
  archivedLoading: false,
  epics: [],
  stories: [],
  modules: [],
  tags: [],
  members: [],
  versions: [],
  sprints: [],
  costCenters: [],
  advancedChecklists: false,
  onCloseItem: () => {},
  onCloseStory: () => {},
  onCloseEpic: () => {},
  onCloseModule: () => {},
  onCloseArchive: () => {},
  onCloseArchived: () => {},
  onCreate: async () => {},
  onSaveItem: async () => {},
  onSaveStory: async () => {},
  onSaveEpic: async () => {},
  onOpenChild: () => {},
  onAddSubtask: async () => {},
  onCreateTag: async () => ({ id: 'tag', name: '', color: '#000' }),
  onEditTag: async () => {},
  onCreateStory: async () => ({ id: 'story', title: '', epicId: 'epic' }),
  onArchive: () => {},
  onUnarchive: () => {},
  onModuleCreate: () => {},
  onModuleNameChange: () => {},
  onModuleDescriptionChange: () => {},
  t,
}

describe('BoardModals (DOM por papel/rótulo)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  test('modal de módulo: cria só com nome e cancela', async () => {
    const user = userEvent.setup()
    let criados = 0
    let cancelamentos = 0
    render(<BoardModals {...baseProps} moduleOpen onModuleCreate={() => { criados += 1 }} onCloseModule={() => { cancelamentos += 1 }} />)

    const criar = screen.getByRole('button', { name: t('create') })
    expect(criar).toBeDisabled()
    expect(screen.getByLabelText(t('moduleLabel'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('cancel') }))
    expect(cancelamentos).toBe(1)
    expect(criados).toBe(0)
  })

  test('confirmação de arquivamento expõe título e ações', async () => {
    const user = userEvent.setup()
    let arquivados = 0
    let cancelamentos = 0
    render(<BoardModals {...baseProps} archiveConfirm={{ itemId: 'item-1', childrenCount: 2 }} onArchive={() => { arquivados += 1 }} onCloseArchive={() => { cancelamentos += 1 }} />)

    expect(screen.getByText(t('archiveCascadeConfirmation', { count: 2 }))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('archiveItem') }))
    await user.click(screen.getByRole('button', { name: t('cancel') }))

    expect(arquivados).toBe(1)
    expect(cancelamentos).toBe(1)
  })

  test('lista arquivados e restaura pelo botão rotulado', async () => {
    const user = userEvent.setup()
    const restaurados: string[] = []
    render(<BoardModals {...baseProps} archivedOpen archivedItems={[{ id: 'arch-1', title: 'Card antigo', type: 'TASK', ancestryPath: '[]', statusBeforeArchive: 'NOT_STARTED', updatedAt: '2026-10-06T00:00:00.000Z' }]} onUnarchive={id => { restaurados.push(id) }} />)

    expect(screen.getByText('Card antigo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t('back') }))

    expect(restaurados).toEqual(['arch-1'])
  })

  test('diálogo expõe role/aria e fecha com Escape', async () => {
    const user = userEvent.setup()
    let cancelamentos = 0

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>abrir</button>
          <BoardModals {...baseProps} moduleOpen={open} onCloseModule={() => { cancelamentos += 1; setOpen(false) }} />
        </>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))

    const dialog = screen.getByRole('dialog', { name: t('newModule') })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: t('close') })).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(dialog))

    await user.keyboard('{Escape}')
    expect(cancelamentos).toBe(1)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
