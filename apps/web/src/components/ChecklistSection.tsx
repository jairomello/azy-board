import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import type { Checklist, ChecklistItem } from '@azy-board/types'
import { useTranslation } from 'react-i18next'
import { RichTextEditor } from './RichTextEditor'

interface ChecklistMember {
  userId: string
  name: string
  avatarUrl?: string | null
}

interface Props {
  itemId: string
  projectId: string
  initialChecklists: Checklist[]
  onChange?: (checklists: Checklist[]) => void
  advancedChecklists?: boolean
  members?: ChecklistMember[]
}

export function ChecklistSection({ itemId, projectId, initialChecklists, onChange, advancedChecklists = false, members = [] }: Props) {
  const { t } = useTranslation('board')
  const [lists, setLists] = useState<Checklist[]>(initialChecklists)
  const [newListName, setNewListName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [addingToList, setAddingToList] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [notesItem, setNotesItem] = useState<{ checklistId: string; item: ChecklistItem } | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const newItemRef = useRef<HTMLInputElement>(null)

  const baseUrl = `/projects/${projectId}/items/${itemId}/checklists`

  useEffect(() => {
    setLists(initialChecklists)
  }, [itemId, initialChecklists])

  useEffect(() => {
    onChange?.(lists)
  }, [lists, onChange])

  function progress(list: Checklist) {
    const total = list.items.length
    const checked = list.items.filter(i => i.checked).length
    return { checked, total }
  }

  function replaceItem(checklistId: string, itemIdToReplace: string, changes: Partial<ChecklistItem>) {
    setLists(prev => prev.map(l => l.id === checklistId
      ? { ...l, items: l.items.map(i => i.id === itemIdToReplace ? { ...i, ...changes } : i) }
      : l
    ))
  }

  async function handleCreateList() {
    if (!newListName.trim()) return
    setMutationError('')
    try {
      const created = await api.post<Checklist>(`${baseUrl}`, { name: newListName.trim() })
      setLists(prev => [...prev, { ...created, items: [] }])
      setNewListName('')
      setShowNewForm(false)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : t('checklistSaveError'))
    }
  }

  async function handleDeleteList(checklistId: string) {
    setMutationError('')
    try {
      await api.delete(`${baseUrl}/${checklistId}`)
      setLists(prev => prev.filter(l => l.id !== checklistId))
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : t('checklistSaveError'))
    }
  }

  async function handleAddItem(checklistId: string) {
    if (!newItemText.trim()) return
    setMutationError('')
    try {
      const created = await api.post<ChecklistItem>(`${baseUrl}/${checklistId}/items`, { text: newItemText.trim() })
      setLists(prev => prev.map(l => l.id === checklistId
        ? { ...l, items: [...l.items, created] }
        : l
      ))
      setNewItemText('')
      newItemRef.current?.focus()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : t('checklistSaveError'))
    }
  }

  async function handleToggleItem(checklistId: string, item: ChecklistItem) {
    // Update otimista com rollback em caso de erro
    const newChecked = !item.checked
    setMutationError('')
    replaceItem(checklistId, item.id, { checked: newChecked })
    try {
      await api.patch(`${baseUrl}/${checklistId}/items/${item.id}`, { checked: newChecked })
    } catch (error) {
      replaceItem(checklistId, item.id, { checked: item.checked })
      setMutationError(error instanceof Error ? error.message : t('checklistSaveError'))
    }
  }

  async function handleDeleteItem(checklistId: string, itemId: string) {
    setMutationError('')
    try {
      await api.delete(`${baseUrl}/${checklistId}/items/${itemId}`)
      setLists(prev => prev.map(l => l.id === checklistId
        ? { ...l, items: l.items.filter(i => i.id !== itemId) }
        : l
      ))
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : t('checklistSaveError'))
    }
  }

  // Atualiza um campo avançado com rollback em caso de erro
  async function handleAdvancedChange(checklistId: string, item: ChecklistItem, changes: Partial<ChecklistItem>) {
    const previous: Partial<ChecklistItem> = {}
    for (const key of Object.keys(changes) as Array<keyof ChecklistItem>) previous[key] = item[key] as never
    setMutationError('')
    replaceItem(checklistId, item.id, changes)
    try {
      const updated = await api.patch<ChecklistItem>(`${baseUrl}/${checklistId}/items/${item.id}`, changes)
      replaceItem(checklistId, item.id, updated)
    } catch (error) {
      replaceItem(checklistId, item.id, previous)
      setMutationError(error instanceof Error ? error.message : t('checklistAdvancedSaveError'))
    }
  }

  function openNotes(checklistId: string, item: ChecklistItem) {
    setNotesItem({ checklistId, item })
    setNotesDraft(item.description ?? '')
    setMutationError('')
  }

  async function handleSaveNotes() {
    if (!notesItem || notesSaving) return
    setNotesSaving(true)
    setMutationError('')
    try {
      const updated = await api.patch<ChecklistItem>(
        `${baseUrl}/${notesItem.checklistId}/items/${notesItem.item.id}`,
        { description: notesDraft || null },
      )
      replaceItem(notesItem.checklistId, notesItem.item.id, updated)
      setNotesItem(null)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : t('checklistAdvancedSaveError'))
    } finally {
      setNotesSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t('checklists')}</h3>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition"
        >
          {t('newChecklist')}
        </button>
      </div>

      {showNewForm && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateList(); if (e.key === 'Escape') setShowNewForm(false) }}
            placeholder={t('checklistName')}
            className="flex-1 text-sm px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleCreateList}
            className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            {t('createAction')}
          </button>
          <button
            onClick={() => setShowNewForm(false)}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition"
          >
            ✕
          </button>
        </div>
      )}

      {mutationError && <p className="text-sm text-destructive">{mutationError}</p>}

      {lists.map(list => {
        const { checked, total } = progress(list)
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0
        const done = total > 0 && checked === total

        return (
          <div key={list.id} className="space-y-2">
            {/* Header do checklist */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{list.name}</span>
                  <span className={`text-xs tabular-nums ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {checked}/{total} {t('completedItems')}
                  </span>
                </div>
                {total > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeleteList(list.id)}
                className="flex-shrink-0 p-1 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition"
                title={t('deleteChecklist')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Itens */}
            <div className="space-y-1 pl-1">
              {list.items.map(item => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggleItem(list.id, item)}
                    className="w-3.5 h-3.5 rounded border-border accent-primary flex-shrink-0 cursor-pointer"
                  />
                  <span className={`flex-1 text-sm ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.text}
                  </span>

                  {advancedChecklists && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="date"
                        aria-label={t('checklistDueDate')}
                        title={t('checklistDueDate')}
                        value={item.dueDate ?? ''}
                        onChange={e => void handleAdvancedChange(list.id, item, { dueDate: e.target.value || null })}
                        className="text-xs px-1.5 py-0.5 rounded border border-border bg-background text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <select
                        aria-label={t('checklistAssignee')}
                        title={t('checklistAssignee')}
                        value={item.assigneeId ?? ''}
                        onChange={e => void handleAdvancedChange(list.id, item, { assigneeId: e.target.value || null })}
                        className="text-xs max-w-[9rem] px-1.5 py-0.5 rounded border border-border bg-background text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">{t('unassigned')}</option>
                        {members.map(member => (
                          <option key={member.userId} value={member.userId}>{member.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => openNotes(list.id, item)}
                        aria-label={t('checklistNotes')}
                        title={t('checklistNotes')}
                        className={`relative p-1 rounded transition hover:bg-muted ${item.description ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {item.description && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => handleDeleteItem(list.id, item.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground/40 hover:text-red-500 transition"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar item */}
            {addingToList === list.id ? (
              <div className="flex gap-2 pl-1">
                <input
                  ref={newItemRef}
                  autoFocus
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddItem(list.id)
                    if (e.key === 'Escape') { setAddingToList(null); setNewItemText('') }
                  }}
                  placeholder={t('newItem')}
                  className="flex-1 text-sm px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => handleAddItem(list.id)}
                  className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
                >
                  +
                </button>
                <button
                  onClick={() => { setAddingToList(null); setNewItemText('') }}
                  className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAddingToList(list.id); setNewItemText('') }}
                className="pl-1 text-xs text-muted-foreground hover:text-foreground transition"
              >
                {t('addItem')}
              </button>
            )}
          </div>
        )
      })}

      {/* Modal de descrição detalhada do item */}
      {notesItem && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 sm:p-6"
          role="presentation"
          onMouseDown={event => { if (event.target === event.currentTarget) setNotesItem(null) }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t('checklistNotesModalTitle')}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">{t('checklistNotesModalTitle')}</h2>
                <p className="text-xs text-muted-foreground truncate">{notesItem.item.text}</p>
              </div>
              <button type="button" onClick={() => setNotesItem(null)} aria-label={t('close')} title={t('close')} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <RichTextEditor
                content={notesDraft}
                onChange={setNotesDraft}
                placeholder={t('checklistNotesPlaceholder')}
                minHeight="240px"
                showExpand={false}
                fieldLabel={t('checklistNotes')}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button type="button" onClick={() => setNotesItem(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                {t('cancel')}
              </button>
              <button type="button" onClick={() => void handleSaveNotes()} disabled={notesSaving} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {t('save')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
