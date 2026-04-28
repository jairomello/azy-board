import { useState } from 'react'
import { RichTextEditor } from './RichTextEditor'

interface Epic { id: string; title: string }

export interface StoryData {
  id?: string
  title: string
  epicId: string
  persona?: string | null
  goal?: string | null
  benefit?: string | null
  acceptanceCriteria?: string | null
  notes?: string | null
  description?: string | null
}

interface Props {
  epics: Epic[]
  story?: StoryData | null
  onSave: (data: StoryData) => Promise<void>
  onClose: () => void
}

export function StoryModal({ epics, story, onSave, onClose }: Props) {
  const [title, setTitle] = useState(story?.title ?? '')
  const [epicId, setEpicId] = useState(story?.epicId ?? epics[0]?.id ?? '')
  const [persona, setPersona] = useState(story?.persona ?? '')
  const [goal, setGoal] = useState(story?.goal ?? '')
  const [benefit, setBenefit] = useState(story?.benefit ?? '')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(story?.acceptanceCriteria ?? '')
  const [notes, setNotes] = useState(story?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!title.trim() || !epicId) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: story?.id,
        title: title.trim(),
        epicId,
        persona: persona || null,
        goal: goal || null,
        benefit: benefit || null,
        acceptanceCriteria: acceptanceCriteria || null,
        notes: notes || null,
      })
      onClose()
    } catch {
      setError('Erro ao salvar história.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground text-lg">
            {story?.id ? 'Editar história' : 'Nova história'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Título e Épico */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título da história *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                placeholder="Ex: Gerenciamento de tarefas por sprint"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Épico *</label>
              <select
                value={epicId}
                onChange={e => setEpicId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              >
                {epics.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          </div>

          {/* Campos ágeis padrão */}
          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Narrativa ágil</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Como</label>
              <input
                value={persona}
                onChange={e => setPersona(e.target.value)}
                placeholder="[persona / papel de usuário]"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Eu quero</label>
              <input
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="[ação que desejo realizar]"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Para que</label>
              <input
                value={benefit}
                onChange={e => setBenefit(e.target.value)}
                placeholder="[benefício ou resultado esperado]"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Critérios de Aceitação */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Critérios de aceitação</label>
            <RichTextEditor
              content={acceptanceCriteria}
              onChange={setAcceptanceCriteria}
              placeholder="Liste os critérios que definem quando esta história está concluída..."
              minHeight="100px"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
            <RichTextEditor
              content={notes}
              onChange={setNotes}
              placeholder="Observações, contexto adicional, referências..."
              minHeight="80px"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !epicId}
            className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {saving ? 'Salvando...' : 'Salvar história'}
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
