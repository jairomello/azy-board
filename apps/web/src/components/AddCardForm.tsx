import { useState, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import type { ItemType } from '@azy-board/types'

interface Props {
  versions?: Array<{ id: string; name: string }>
  sprints?: Array<{ id: string; name: string; status: 'PROPOSED' | 'OPEN' | 'CLOSED' }>
  onAdd: (title: string, type: ItemType, versionId?: string, sprintId?: string) => Promise<void>
  onCancel: () => void
}

export function AddCardForm({ versions = [], sprints = [], onAdd, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ItemType>('TASK')
  const [versionId, setVersionId] = useState('')
  const [sprintId, setSprintId] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit() {
    const trimmed = title.trim()
    if (!trimmed || loading) return
    setLoading(true)
    try {
      await onAdd(trimmed, type, versionId || undefined, sprintId || undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-2 space-y-2">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Título do card..."
        className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
      />
      <select
        value={type}
        onChange={e => setType(e.target.value as ItemType)}
        className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg outline-none focus:border-primary"
      >
        <option value="TASK">Tarefa</option>
        <option value="BUG">Bug</option>
      </select>
      <select aria-label="Sprint" value={sprintId} onChange={e => setSprintId(e.target.value)} className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg outline-none focus:border-primary">
        <option value="">Sem sprint</option>
        {sprints.length === 0 && <option disabled>Nenhuma sprint cadastrada</option>}
        {sprints.filter(sprint => sprint.status !== 'CLOSED').map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
      </select>
      <select aria-label="Versão" value={versionId} onChange={e => setVersionId(e.target.value)} className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg outline-none focus:border-primary">
        <option value="">Sem versão</option>
        {versions.length === 0 && <option disabled>Nenhuma versão cadastrada</option>}
        {versions.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || !title.trim()}
          className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {loading ? '...' : 'Adicionar'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>
    </div>
  )
}
