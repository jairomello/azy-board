import type { ItemType } from '@azy-board/types'
import type { Tag } from './TagSelector'

interface Module { id: string; name: string }
interface Sprint { id: string; name: string; status: string }
interface Member { userId: string; name: string }

export interface BoardFilterState {
  moduleId: string
  sprintId: string
  assigneeId: string
  types: ItemType[]
  tagIds: string[]
}

interface Props {
  modules: Module[]
  sprints: Sprint[]
  members: Member[]
  tags: Tag[]
  filters: BoardFilterState
  onChange: (filters: BoardFilterState) => void
}

const TYPE_LABELS: Partial<Record<ItemType, string>> = {
  TASK: 'Tarefa',
  BUG: 'Bug',
}

export function BoardFilters({ modules, sprints, members, tags, filters, onChange }: Props) {
  const activeCount = [
    filters.moduleId,
    filters.sprintId,
    filters.assigneeId,
    filters.types.length > 0,
    filters.tagIds.length > 0,
  ].filter(Boolean).length

  function update(partial: Partial<BoardFilterState>) {
    onChange({ ...filters, ...partial })
  }

  function clear() {
    onChange({ moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [] })
  }

  function toggleType(t: ItemType) {
    const already = filters.types.includes(t)
    update({ types: already ? filters.types.filter(x => x !== t) : [...filters.types, t] })
  }

  function toggleTag(id: string) {
    const already = filters.tagIds.includes(id)
    update({ tagIds: already ? filters.tagIds.filter(x => x !== id) : [...filters.tagIds, id] })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Módulo */}
      {modules.length > 0 && (
        <select
          value={filters.moduleId}
          onChange={e => update({ moduleId: e.target.value })}
          className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground"
        >
          <option value="">Módulo</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      {/* Sprint */}
      {sprints.length > 0 && (
        <select
          value={filters.sprintId}
          onChange={e => update({ sprintId: e.target.value })}
          className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground"
        >
          <option value="">Sprint</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {/* Responsável */}
      {members.length > 0 && (
        <select
          value={filters.assigneeId}
          onChange={e => update({ assigneeId: e.target.value })}
          className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground"
        >
          <option value="">Responsável</option>
          {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      )}

      {/* Tipo (multi) — apenas TASK e BUG filtráveis no board */}
      <div className="flex items-center gap-1">
        {(['TASK', 'BUG'] as ItemType[]).map(t => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`text-xs px-2 py-1 rounded-full border transition ${
              filters.types.includes(t)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tags (multi) */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`text-xs px-2 py-0.5 rounded-full border transition text-white ${
                filters.tagIds.includes(tag.id) ? 'opacity-100 ring-2 ring-offset-1 ring-foreground/30' : 'opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: tag.color, borderColor: tag.color }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Limpar */}
      {activeCount > 0 && (
        <button
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Limpar ({activeCount})
        </button>
      )}
    </div>
  )
}
