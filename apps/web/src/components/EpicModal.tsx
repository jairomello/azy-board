import { useState } from 'react'

interface Module { id: string; name: string }

export interface EpicData {
  id?: string
  title: string
  moduleId: string
  description?: string | null
}

interface Props {
  modules: Module[]
  epic?: EpicData | null
  onSave: (data: EpicData) => Promise<void>
  onClose: () => void
}

export function EpicModal({ modules, epic, onSave, onClose }: Props) {
  const [title, setTitle] = useState(epic?.title ?? '')
  const [moduleId, setModuleId] = useState(epic?.moduleId ?? modules[0]?.id ?? '')
  const [description, setDescription] = useState(epic?.description ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setLoading(true)
    try {
      await onSave({ id: epic?.id, title: title.trim(), moduleId, description: description || undefined })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 mx-4">
        <h2 className="text-lg font-semibold text-foreground">
          {epic?.id ? 'Editar épico' : 'Novo épico'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Módulo</label>
            <select
              value={moduleId}
              onChange={e => setModuleId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
            >
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-muted text-muted-foreground transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
