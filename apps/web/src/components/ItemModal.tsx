import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Info, Plus, Check, X } from 'lucide-react'
import type { Priority, TaskStatus, ItemType, Checklist } from '@azy-board/types'
import { InlineEdit } from './InlineEdit'
import { TagSelector, type Tag } from './TagSelector'
import { StorySelector } from './StorySelector'
import { AddCardForm } from './AddCardForm'
import { ChecklistSection } from './ChecklistSection'
import { api } from '../lib/api'

interface Epic { id: string; title: string }
interface StoryOption { id: string; title: string; epicId: string }

export interface ProjectMember {
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
  role: string
}

export interface FullItemData {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  type?: ItemType | null
  points?: number | null
  description?: string | null
  startDate?: string | null
  dueDate?: string | null
  parentId?: string | null
  assigneeId?: string | null
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  itemTags?: Array<{ tag: Tag }>
  taskTags?: Array<{ tag: Tag }>
  isLeaf: boolean
  ancestryPath: string
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Não iniciada' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'BLOCKED', label: 'Bloqueada' },
  { value: 'DONE', label: 'Concluída' },
  { value: 'CANCELLED', label: 'Cancelada' },
]

const TYPE_OPTIONS: { value: 'TASK' | 'BUG'; label: string }[] = [
  { value: 'TASK', label: 'Tarefa' },
  { value: 'BUG', label: 'Bug' },
]

interface Props {
  item: FullItemData
  projectId: string
  epics: Epic[]
  stories: StoryOption[]
  projectTags: Tag[]
  members: ProjectMember[]
  onClose: () => void
  onSave: (itemId: string, changes: Partial<FullItemData>, tagIds: string[]) => Promise<void>
  onAddSubtask: (parentId: string, title: string, type: ItemType) => Promise<void>
  onCreateTag: (name: string, color: string) => Promise<Tag>
  onEditTag: (tagId: string, name: string, color: string) => Promise<void>
  onCreateStory: (title: string, epicId: string) => Promise<StoryOption>
}

export function ItemModal({
  item,
  projectId,
  epics,
  stories,
  projectTags,
  members,
  onClose,
  onSave,
  onAddSubtask,
  onCreateTag,
  onEditTag,
  onCreateStory,
}: Props) {
  const [title, setTitle] = useState(item.title)
  const [priority, setPriority] = useState<Priority>(item.priority)
  const [status, setStatus] = useState<TaskStatus>(item.status)
  const [type, setType] = useState<'TASK' | 'BUG'>((item.type === 'BUG' ? 'BUG' : 'TASK'))
  const [assigneeId, setAssigneeId] = useState<string>(item.assigneeId ?? item.assignee?.id ?? '')
  const [parentId, setParentId] = useState<string | null>(item.parentId ?? null)
  const [selectedTags, setSelectedTags] = useState<Tag[]>(
    (item.itemTags ?? item.taskTags ?? []).map(it => it.tag)
  )
  const [points, setPoints] = useState(item.points?.toString() ?? '')
  const [startDate, setStartDate] = useState(item.startDate ?? '')
  const [dueDate, setDueDate] = useState(item.dueDate ?? '')
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [checklists, setChecklists] = useState<Checklist[]>([])

  // Carrega checklists ao abrir modal de item existente
  useEffect(() => {
    if (item.id === '__new__') { setChecklists([]); return }
    let cancelled = false
    setChecklists([])
    api.get<Checklist[]>(`/projects/${projectId}/items/${item.id}/checklists`)
      .then(data => { if (!cancelled) setChecklists(data) })
      .catch(() => { if (!cancelled) setChecklists([]) })
    return () => { cancelled = true }
  }, [item.id, projectId])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Adicionar descrição...' }),
    ],
    content: item.description ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none min-h-[80px] text-sm text-foreground',
      },
    },
  })

  useEffect(() => {
    setTitle(item.title)
    setPriority(item.priority)
    setStatus(item.status)
    setType(item.type === 'BUG' ? 'BUG' : 'TASK')
    setAssigneeId(item.assigneeId ?? item.assignee?.id ?? '')
    setParentId(item.parentId ?? null)
    setSelectedTags((item.itemTags ?? item.taskTags ?? []).map(it => it.tag))
    setPoints(item.points?.toString() ?? '')
    setStartDate(item.startDate ?? '')
    setDueDate(item.dueDate ?? '')
  }, [item.id])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const descriptionHtml = editor?.getHTML() ?? ''
      await onSave(item.id, {
        title,
        priority,
        status,
        type,
        parentId,
        assigneeId: assigneeId || null,
        points: points ? parseInt(points) : null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        description: descriptionHtml === '<p></p>' ? null : descriptionHtml,
      }, selectedTags.map(t => t.id))
      onClose()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex-1 mr-4">
            <InlineEdit value={title} onSave={setTitle} className="text-base font-semibold" />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Box informativa para cards bloqueados (com subtasks) */}
          {!item.isLeaf && (
            <div className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Este card tem subtasks. Seu status no board é determinado pelo progresso dos seus filhos — por isso ele não pode ser arrastado manualmente. Para mover este card, mova ou conclua as subtasks.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as 'TASK' | 'BUG')}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsável</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                <option value="">Não atribuído</option>
                {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pontos</label>
              <input type="number" min="0" value={points} onChange={e => setPoints(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
                placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Início</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-2 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-2 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary" />
              </div>
            </div>
          </div>

          {epics.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">História pai</label>
              <StorySelector
                epics={epics}
                stories={stories}
                value={parentId}
                onChange={setParentId}
                onCreateStory={onCreateStory}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
            <TagSelector
              allTags={projectTags}
              selected={selectedTags}
              onSelect={setSelectedTags}
              onCreate={onCreateTag}
              onEdit={onEditTag}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <div className="border border-border rounded-lg p-3 bg-background min-h-[100px] cursor-text">
              <EditorContent editor={editor} />
            </div>
          </div>

          {item.isLeaf && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subtasks</label>
              {showSubtaskForm ? (
                <AddCardForm
                  onAdd={async (subTitle, subType) => {
                    await onAddSubtask(item.id, subTitle, subType)
                    setShowSubtaskForm(false)
                  }}
                  onCancel={() => setShowSubtaskForm(false)}
                />
              ) : (
                <button onClick={() => setShowSubtaskForm(true)}
                  className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar subtask
                </button>
              )}
            </div>
          )}

          {item.id !== '__new__' && (
            <div className="border-t border-border pt-4">
              <ChecklistSection
                itemId={item.id}
                projectId={projectId}
                initialChecklists={checklists}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
            <Check className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
