import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#64748b',
]

export interface Tag {
  id: string
  name: string
  color: string
}

interface Props {
  allTags: Tag[]
  selected: Tag[]
  onSelect: (tags: Tag[]) => void
  onCreate: (name: string, color: string) => Promise<Tag>
  onEdit?: (tagId: string, name: string, color: string) => Promise<void>
}

interface DropdownPos { top: number; left: number; width: number }

export function TagSelector({ allTags, selected, onSelect, onCreate, onEdit }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newColor, setNewColor] = useState(TAG_COLORS[0]!)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 240 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const updatePos = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    })
  }, [])

  function openDropdown() {
    updatePos()
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  useEffect(() => {
    if (!open) return
    function handleClose(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClose)
    return () => document.removeEventListener('mousedown', handleClose)
  }, [open])

  const filtered = allTags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find(s => s.id === t.id)
  )
  const canCreate = search.trim() && !allTags.find(t => t.name.toLowerCase() === search.trim().toLowerCase())

  function toggle(tag: Tag) {
    const already = selected.find(s => s.id === tag.id)
    onSelect(already ? selected.filter(s => s.id !== tag.id) : [...selected, tag])
  }

  async function handleCreate() {
    if (!search.trim()) return
    setCreating(true)
    try {
      const tag = await onCreate(search.trim(), newColor)
      onSelect([...selected, tag])
      setSearch('')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(tag: Tag, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingTag(tag)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  async function saveEdit() {
    if (!editingTag || !editName.trim()) { setEditingTag(null); return }
    await onEdit?.(editingTag.id, editName.trim(), editColor)
    setEditingTag(null)
  }

  const dropdown = open ? (
    <div
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
      }}
      className="bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto"
      onMouseDown={e => e.preventDefault()}
    >
      <div className="p-1.5 border-b border-border">
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canCreate && handleCreate()}
          placeholder="Buscar ou criar tag..."
          className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary"
        />
      </div>
      {filtered.map(tag => (
        <div key={tag.id} className="flex items-center group px-3 py-2 text-sm hover:bg-muted cursor-pointer">
          <div className="flex items-center gap-2 flex-1" onMouseDown={() => toggle(tag)}>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
            <span className="flex-1">{tag.name}</span>
          </div>
          <button
            onMouseDown={e => startEdit(tag, e)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      ))}
      {canCreate && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex flex-wrap gap-1 mb-2">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                onMouseDown={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full border-2 transition ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onMouseDown={handleCreate}
            disabled={creating}
            className="w-full text-left text-xs text-primary hover:underline disabled:opacity-50"
          >
            {creating ? 'Criando...' : `Criar tag "${search}"`}
          </button>
        </div>
      )}
      {filtered.length === 0 && !canCreate && (
        <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma tag encontrada</p>
      )}
    </div>
  ) : null

  return (
    <div ref={containerRef} className="relative">
      {/* Chips selecionados */}
      <div
        className="flex flex-wrap gap-1 min-h-9 p-1.5 border border-border rounded-lg cursor-text bg-background"
        onClick={openDropdown}
      >
        {selected.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white cursor-pointer hover:opacity-80"
            style={{ backgroundColor: tag.color }}
            onClick={e => { e.stopPropagation(); startEdit(tag, e) }}
          >
            {tag.name}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(tag) }}
              className="hover:opacity-70 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">Selecionar tags...</span>
        )}
      </div>

      {/* Modal de edição de tag */}
      {editingTag && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Editar tag</p>
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingTag(null) }}
            autoFocus
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-1">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                className={`w-4 h-4 rounded-full border-2 transition ${editColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={saveEdit} className="flex-1 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition">
              Salvar
            </button>
            <button onClick={() => setEditingTag(null)} className="flex-1 py-1 text-xs border border-border rounded hover:bg-muted text-muted-foreground transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}
