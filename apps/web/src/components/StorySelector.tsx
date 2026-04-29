import { useState, useRef, useEffect } from 'react'

interface Epic { id: string; title: string }

export interface Story { id: string; title: string; epicId: string }

interface Props {
  epics: Epic[]
  stories: Story[]
  value: string | null
  onChange: (storyId: string | null) => void
  onCreateStory: (title: string, epicId: string) => Promise<Story>
}

export function StorySelector({ epics, stories, value, onChange, onCreateStory }: Props) {
  const [open, setOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEpicId, setNewEpicId] = useState(epics[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [localStories, setLocalStories] = useState(stories)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const selected = localStories.find(s => s.id === value)

  // Posição fixa calculada para evitar clipping por overflow:hidden da modal
  function openDropdown() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (!buttonRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  async function handleCreate() {
    if (!newTitle.trim() || !newEpicId) return
    setCreating(true)
    try {
      const story = await onCreateStory(newTitle.trim(), newEpicId)
      setLocalStories(prev => [...prev, story])
      onChange(story.id)
      setShowCreate(false)
      setNewTitle('')
      setOpen(false)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-background border border-border rounded-lg hover:border-primary transition text-left"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.title : 'Selecionar história...'}
        </span>
        <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          style={dropdownStyle}
          className="bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto"
        >
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { onChange(null); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Sem história
          </button>

          {epics.map(epic => {
            const epicStories = localStories.filter(s => s.epicId === epic.id)
            if (epicStories.length === 0 && !showCreate) return null
            return (
              <div key={epic.id}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 uppercase tracking-wide sticky top-0">
                  {epic.title}
                </div>
                {epicStories.map(story => (
                  <button
                    key={story.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onChange(story.id); setOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-muted ${value === story.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                  >
                    {story.title}
                  </button>
                ))}
              </div>
            )
          })}

          {!showCreate ? (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowCreate(true)}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted border-t border-border"
            >
              + Nova história
            </button>
          ) : (
            <div className="p-3 border-t border-border space-y-2" onMouseDown={e => e.stopPropagation()}>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
                placeholder="Título da história..."
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded outline-none focus:border-primary"
              />
              <select
                value={newEpicId}
                onChange={e => setNewEpicId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded outline-none"
              >
                {epics.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="flex-1 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  {creating ? '...' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewTitle('') }}
                  className="flex-1 py-1 text-xs border border-border rounded hover:bg-muted text-muted-foreground transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
