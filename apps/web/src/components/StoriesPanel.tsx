import { useState } from 'react'
import { api } from '../lib/api'

interface Epic { id: string; title: string }

export interface Story {
  id: string
  title: string
  epicId: string
  description?: string | null
}

interface Props {
  projectId: string
  epics: Epic[]
  stories: Story[]
  onClose: () => void
  onStoriesChange: (stories: Story[]) => void
}

interface EditState {
  id: string
  title: string
  epicId: string
}

export function StoriesPanel({ projectId, epics, stories, onClose, onStoriesChange }: Props) {
  const [newTitle, setNewTitle] = useState('')
  const [newEpicId, setNewEpicId] = useState(epics[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function handleCreate() {
    if (!newTitle.trim() || !newEpicId) return
    setCreating(true)
    try {
      const story = await api.post<Story>(`/projects/${projectId}/stories`, {
        title: newTitle.trim(),
        epicId: newEpicId,
      })
      onStoriesChange([...stories, story])
      setNewTitle('')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit() {
    if (!editing || !editing.title.trim()) return
    setSaving(true)
    try {
      await api.patch(`/projects/${projectId}/stories/${editing.id}`, {
        title: editing.title.trim(),
        epicId: editing.epicId,
      })
      onStoriesChange(stories.map(s =>
        s.id === editing.id ? { ...s, title: editing.title.trim(), epicId: editing.epicId } : s
      ))
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(storyId: string) {
    try {
      await api.delete(`/projects/${projectId}/stories/${storyId}`)
      onStoriesChange(stories.filter(s => s.id !== storyId))
      setConfirmDelete(null)
    } catch {
      // silently ignore for now
    }
  }

  const storiesByEpic = epics.map(epic => ({
    epic,
    stories: stories.filter(s => s.epicId === epic.id),
  }))

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Painel lateral */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-foreground">Histórias de usuário</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulário de criação */}
        <div className="px-5 py-4 border-b border-border flex-shrink-0 space-y-2 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova história</p>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Título da história..."
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
          />
          <select
            value={newEpicId}
            onChange={e => setNewEpicId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
          >
            {epics.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim() || !newEpicId}
            className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {creating ? 'Criando...' : 'Criar história'}
          </button>
        </div>

        {/* Lista agrupada por épico */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {storiesByEpic.filter(g => g.stories.length > 0).map(({ epic, stories: epicStories }) => (
            <div key={epic.id}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {epic.title}
              </p>
              <div className="space-y-1.5">
                {epicStories.map(story => (
                  <div key={story.id} className="group bg-background border border-border rounded-lg">
                    {editing?.id === story.id ? (
                      /* Modo edição inline */
                      <div className="p-3 space-y-2">
                        <input
                          value={editing.title}
                          onChange={e => setEditing({ ...editing, title: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          autoFocus
                          className="w-full px-2 py-1.5 text-sm bg-background border border-primary rounded outline-none"
                        />
                        <select
                          value={editing.epicId}
                          onChange={e => setEditing({ ...editing, epicId: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded outline-none"
                        >
                          {epics.map(e => (
                            <option key={e.id} value={e.id}>{e.title}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="flex-1 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition"
                          >
                            {saving ? '...' : 'Salvar'}
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="flex-1 py-1 text-xs border border-border rounded hover:bg-muted text-muted-foreground transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : confirmDelete === story.id ? (
                      /* Confirmação de exclusão */
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">Excluir "{story.title}"?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(story.id)}
                            className="flex-1 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition"
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex-1 py-1 text-xs border border-border rounded hover:bg-muted text-muted-foreground transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Modo visualização */
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-sm text-foreground truncate flex-1">{story.title}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                          <button
                            onClick={() => setEditing({ id: story.id, title: story.title, epicId: story.epicId })}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete(story.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
                            title="Excluir"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {stories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma história criada ainda.
            </div>
          )}

          {epics.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Crie um épico primeiro para poder adicionar histórias.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
