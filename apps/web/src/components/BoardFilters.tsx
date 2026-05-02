import { Layers, LayoutList, Eye, EyeOff, ChevronsDown, ChevronsUp } from 'lucide-react'
import type { ItemType } from '@azy-board/types'
import type { Tag } from './TagSelector'
import { Tooltip } from './ui/Tooltip'

interface Module { id: string; name: string }
interface Sprint { id: string; name: string; status: string }
interface Member { userId: string; name: string }
interface Squad { id: string; name: string }

export interface BoardFilterState {
  moduleId: string
  sprintId: string
  assigneeId: string
  types: ItemType[]
  tagIds: string[]
  hideEmptyEpics: boolean
  squadId: string
}

interface Props {
  modules: Module[]
  sprints: Sprint[]
  members: Member[]
  tags: Tag[]
  squads?: Squad[]
  filters: BoardFilterState
  onChange: (filters: BoardFilterState) => void
  showSubtasks: boolean
  onToggleSubtasks: () => void
  showStories: boolean
  onToggleStories: () => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  showExpandCollapse?: boolean
}

const TYPE_LABELS: Partial<Record<ItemType, string>> = {
  TASK: 'Tarefa',
  BUG: 'Bug',
}

const TYPE_TOOLTIPS: Partial<Record<ItemType, string>> = {
  TASK: 'Filtrar por Tarefas',
  BUG: 'Filtrar por Bugs',
}

const iconBtn = (active: boolean) =>
  `p-1.5 rounded-lg border transition flex-shrink-0 ${
    active
      ? 'bg-primary/10 border-primary/30 text-primary'
      : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
  }`

const separator = <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />

export function BoardFilters({
  modules, sprints, members, tags, squads = [],
  filters, onChange,
  showSubtasks, onToggleSubtasks,
  showStories, onToggleStories,
  onExpandAll, onCollapseAll, showExpandCollapse = false,
}: Props) {
  const activeCount = [
    filters.moduleId,
    filters.sprintId,
    filters.assigneeId,
    filters.squadId,
    filters.types.length > 0,
    filters.tagIds.length > 0,
    filters.hideEmptyEpics,
  ].filter(Boolean).length

  function update(partial: Partial<BoardFilterState>) {
    onChange({ ...filters, ...partial })
  }

  function clear() {
    onChange({ moduleId: '', sprintId: '', assigneeId: '', squadId: '', types: [], tagIds: [], hideEmptyEpics: false })
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
    <div className="flex items-center gap-1.5 flex-wrap">

      {/* Zona 1 — Visualização */}
      <Tooltip label={showSubtasks ? 'Ocultar subtasks' : 'Mostrar subtasks'}>
        <button onClick={onToggleSubtasks} className={iconBtn(showSubtasks)}>
          <Layers className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <Tooltip label="Histórias no board">
        <button onClick={onToggleStories} className={iconBtn(showStories)}>
          <LayoutList className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      {showExpandCollapse && (
        <>
          <Tooltip label="Expandir tudo">
            <button onClick={onExpandAll} className={iconBtn(false)}>
              <ChevronsDown className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Recolher tudo">
            <button onClick={onCollapseAll} className={iconBtn(false)}>
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </>
      )}

      {separator}

      {/* Zona 2 — Filtros */}
      {squads.length > 0 && (
        <select
          value={filters.squadId}
          onChange={e => update({ squadId: e.target.value })}
          className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground"
        >
          <option value="">Squad</option>
          {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

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

      {/* Tipo (multi) */}
      <div className="flex items-center gap-1">
        {(['TASK', 'BUG'] as ItemType[]).map(t => (
          <Tooltip key={t} label={TYPE_TOOLTIPS[t] ?? TYPE_LABELS[t] ?? t}>
            <button
              onClick={() => toggleType(t)}
              className={`text-xs px-2 py-1 rounded-full border transition ${
                filters.types.includes(t)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          </Tooltip>
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

      {separator}

      {/* Zona 3 — Ações de conteúdo */}
      <Tooltip label="Ocultar épicos vazios">
        <button onClick={() => update({ hideEmptyEpics: !filters.hideEmptyEpics })} className={iconBtn(filters.hideEmptyEpics)}>
          {filters.hideEmptyEpics ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </Tooltip>

      {/* Limpar */}
      {activeCount > 0 && (
        <button
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition ml-1"
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
