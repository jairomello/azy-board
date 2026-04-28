import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import type { Checklist, ChecklistItem } from '@azy-board/types'

interface Props {
  itemId: string
  projectId: string
  initialChecklists: Checklist[]
}

export function ChecklistSection({ itemId, projectId, initialChecklists }: Props) {
  const [lists, setLists] = useState<Checklist[]>(initialChecklists)
  const [newListName, setNewListName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [addingToList, setAddingToList] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const newItemRef = useRef<HTMLInputElement>(null)

  const baseUrl = `/projects/${projectId}/items/${itemId}/checklists`

  useEffect(() => {
    setLists(initialChecklists)
  }, [itemId, initialChecklists])

  function progress(list: Checklist) {
    const total = list.items.length
    const checked = list.items.filter(i => i.checked).length
    return { checked, total }
  }

  async function handleCreateList() {
    if (!newListName.trim()) return
    const created = await api.post<Checklist>(`${baseUrl}`, { name: newListName.trim() })
    setLists(prev => [...prev, { ...created, items: [] }])
    setNewListName('')
    setShowNewForm(false)
  }

  async function handleDeleteList(checklistId: string) {
    await api.delete(`${baseUrl}/${checklistId}`)
    setLists(prev => prev.filter(l => l.id !== checklistId))
  }

  async function handleAddItem(checklistId: string) {
    if (!newItemText.trim()) return
    const created = await api.post<ChecklistItem>(`${baseUrl}/${checklistId}/items`, { text: newItemText.trim() })
    setLists(prev => prev.map(l => l.id === checklistId
      ? { ...l, items: [...l.items, created] }
      : l
    ))
    setNewItemText('')
    newItemRef.current?.focus()
  }

  async function handleToggleItem(checklistId: string, item: ChecklistItem) {
    // Update otimista
    const newChecked = !item.checked
    setLists(prev => prev.map(l => l.id === checklistId
      ? { ...l, items: l.items.map(i => i.id === item.id ? { ...i, checked: newChecked } : i) }
      : l
    ))
    try {
      await api.patch(`${baseUrl}/${checklistId}/items/${item.id}`, { checked: newChecked })
    } catch {
      // Rollback em caso de erro
      setLists(prev => prev.map(l => l.id === checklistId
        ? { ...l, items: l.items.map(i => i.id === item.id ? { ...i, checked: item.checked } : i) }
        : l
      ))
    }
  }

  async function handleDeleteItem(checklistId: string, itemId: string) {
    await api.delete(`${baseUrl}/${checklistId}/items/${itemId}`)
    setLists(prev => prev.map(l => l.id === checklistId
      ? { ...l, items: l.items.filter(i => i.id !== itemId) }
      : l
    ))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Checklists</h3>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition"
        >
          + Novo checklist
        </button>
      </div>

      {showNewForm && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateList(); if (e.key === 'Escape') setShowNewForm(false) }}
            placeholder="Nome do checklist"
            className="flex-1 text-sm px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleCreateList}
            className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            Criar
          </button>
          <button
            onClick={() => setShowNewForm(false)}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition"
          >
            ✕
          </button>
        </div>
      )}

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
                    {checked}/{total} concluídos
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
                title="Excluir checklist"
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
                  placeholder="Novo item..."
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
                + Adicionar item
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
