import { Layers, LayoutList, Eye, EyeOff, ChevronsDown, ChevronsUp } from 'lucide-react'
import type { ItemType } from '@azy-board/types'
import type { Tag } from './TagSelector'
import { Tooltip } from './ui/Tooltip'
import { useTranslation } from 'react-i18next'

interface Module { id: string; name: string }
interface Sprint { id: string; name: string; status: 'PROPOSED' | 'OPEN' | 'CLOSED' }
interface Member { userId: string; name: string }
interface Squad { id: string; name: string }
interface Version { id: string; name: string }
interface CostCenter { id: string; code: string; description?: string | null; sortOrder: number }

export interface BoardFilterState {
  moduleId: string
  sprintId: string
  assigneeId: string
  types: ItemType[]
  tagIds: string[]
  versionId: string
  priority: string
  status: string
  authorId: string
  costCenterId: string
  hideEmptyEpics: boolean
  hideEmptyStories: boolean
  squadId: string
  showSubtasks: boolean
  storyDisplay: 'lanes' | 'cards'
  moduleViewMode: 'hierarchy' | 'tabs'
}

interface Props {
  modules: Module[]
  sprints: Sprint[]
  members: Member[]
  tags: Tag[]
  versions?: Version[]
  costCenters?: CostCenter[]
  squads?: Squad[]
  filters: BoardFilterState
  onChange: (filters: BoardFilterState) => void
  showSubtasks: boolean
  onToggleSubtasks: () => void
  storiesAsCards: boolean
  onToggleStoryDisplay: () => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  showExpandCollapse?: boolean
  showModuleViewMode?: boolean
  section?: 'all' | 'filters' | 'options'
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

export function BoardFilters({
  modules, sprints, members, tags, versions = [], costCenters = [], squads = [],
  filters, onChange,
  showSubtasks, onToggleSubtasks,
  storiesAsCards, onToggleStoryDisplay,
  onExpandAll, onCollapseAll, showExpandCollapse = false, showModuleViewMode = true, section = 'all',
}: Props) {
  const { t } = useTranslation('board')
  const showOptions = section !== 'filters'
  const showDataFilters = section !== 'options'
  const activeCount = [
    filters.moduleId,
    filters.sprintId,
    filters.assigneeId,
    filters.squadId,
    filters.types.length > 0,
    filters.tagIds.length > 0,
    filters.versionId,
    filters.priority,
    filters.status,
    filters.authorId,
    filters.costCenterId,
  ].filter(Boolean).length

  function update(partial: Partial<BoardFilterState>) {
    onChange({ ...filters, ...partial })
  }

  function clear() {
    onChange({
      moduleId: '',
      sprintId: '',
      assigneeId: '',
      squadId: '',
      types: [],
      tagIds: [],
      versionId: '',
      priority: '',
      status: '',
      authorId: '',
      costCenterId: '',
      hideEmptyEpics: false,
      hideEmptyStories: false,
      showSubtasks: filters.showSubtasks,
      storyDisplay: filters.storyDisplay,
      moduleViewMode: filters.moduleViewMode,
    })
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
    <div className="space-y-4">

      {showOptions && <div className="flex items-center gap-1.5 flex-wrap">
        <span className="w-20 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exibição</span>
         {showModuleViewMode && <div className="flex items-center rounded-lg border border-border bg-background p-0.5" aria-label="Modo de módulos">
          <button
            type="button"
            aria-pressed={filters.moduleViewMode === 'hierarchy'}
            onClick={() => update({ moduleViewMode: 'hierarchy' })}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${filters.moduleViewMode === 'hierarchy' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('moduleViewHierarchy')}
          </button>
          <button
            type="button"
            aria-pressed={filters.moduleViewMode === 'tabs'}
            onClick={() => update({ moduleViewMode: 'tabs' })}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${filters.moduleViewMode === 'tabs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t('moduleViewTabs')}
          </button>
        </div>}
        <Tooltip label={showSubtasks ? 'Ocultar subtasks' : 'Mostrar subtasks'}>
          <button aria-pressed={showSubtasks} aria-label="Mostrar subtasks" onClick={onToggleSubtasks} className={iconBtn(showSubtasks)}>
            <Layers className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {showModuleViewMode && <Tooltip label={storiesAsCards ? 'Exibir histórias como lanes' : 'Exibir histórias como cards'}>
          <button
            aria-pressed={storiesAsCards}
            aria-label={storiesAsCards ? 'Exibir histórias como lanes' : 'Exibir histórias como cards'}
            onClick={onToggleStoryDisplay}
            className={iconBtn(storiesAsCards)}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        </Tooltip>}

        {showExpandCollapse && (
          <>
            <Tooltip label="Expandir tudo">
              <button aria-label="Expandir tudo" onClick={onExpandAll} className={iconBtn(false)}>
                <ChevronsDown className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Recolher tudo">
              <button aria-label="Recolher tudo" onClick={onCollapseAll} className={iconBtn(false)}>
                <ChevronsUp className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </>
        )}
        {showModuleViewMode && <Tooltip label="Ocultar épicos vazios">
          <button
            aria-label="Ocultar épicos vazios"
            aria-pressed={filters.hideEmptyEpics}
            onClick={() => update({ hideEmptyEpics: !filters.hideEmptyEpics })}
            className={`${iconBtn(filters.hideEmptyEpics)} flex items-center gap-1.5 px-2`}
          >
            {filters.hideEmptyEpics ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="text-[11px]">Épicos vazios</span>
          </button>
        </Tooltip>}
        {showModuleViewMode && !storiesAsCards && (
          <Tooltip label="Ocultar histórias vazias">
            <button
              aria-label="Ocultar histórias vazias"
              aria-pressed={filters.hideEmptyStories}
              onClick={() => update({ hideEmptyStories: !filters.hideEmptyStories })}
              className={`${iconBtn(filters.hideEmptyStories)} flex items-center gap-1.5 px-2`}
            >
              {filters.hideEmptyStories ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="text-[11px]">Histórias vazias</span>
            </button>
          </Tooltip>
        )}
      </div>}

      {/* Zona 2 — Filtros */}
      {showDataFilters && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {squads.length > 0 && (
        <select
          aria-label="Squad"
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
          aria-label="Módulo"
          value={filters.moduleId}
          onChange={e => update({ moduleId: e.target.value })}
          className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground"
        >
          <option value="">Módulo</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      {(
        <select
          aria-label="Sprint"
          value={filters.sprintId}
          onChange={e => update({ sprintId: e.target.value })}
          className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground"
        >
           <option value="">Sem sprint</option>
           {sprints.length === 0 && <option disabled>Nenhuma sprint cadastrada</option>}
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
       )}

      {members.length > 0 && (
        <select
          aria-label="Responsável"
          value={filters.assigneeId}
          onChange={e => update({ assigneeId: e.target.value })}
          className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground"
        >
          <option value="">Responsável</option>
          {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      )}
      <select aria-label="Versão" value={filters.versionId} onChange={e => update({ versionId: e.target.value })} className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground">
        <option value="">Versão</option>
        {versions.length === 0 && <option disabled>Nenhuma versão cadastrada</option>}
        {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <select aria-label="Prioridade" value={filters.priority} onChange={e => update({ priority: e.target.value })} className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground">
        <option value="">Prioridade</option><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
      </select>
      <select aria-label="Status" value={filters.status} onChange={e => update({ status: e.target.value })} className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground">
        <option value="">Status</option><option value="NOT_STARTED">Não iniciada</option><option value="IN_PROGRESS">Em andamento</option><option value="BLOCKED">Bloqueada</option><option value="DONE">Concluída</option><option value="CANCELLED">Cancelada</option>
      </select>
      {members.length > 0 && <select aria-label="Autor" value={filters.authorId} onChange={e => update({ authorId: e.target.value })} className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground">
        <option value="">Autor</option>{members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>}
      <select aria-label="Centro de Custo" value={filters.costCenterId} onChange={e => update({ costCenterId: e.target.value })} className="text-xs px-2 py-1 bg-background border border-border rounded-lg outline-none focus:border-primary text-muted-foreground">
        <option value="">Todos os centros</option>
        {costCenters.length === 0 && <option disabled>Nenhum centro de custo cadastrado</option>}
        {costCenters.map(center => (
          <option key={center.id} value={center.id}>{center.code}{center.description ? ` - ${center.description}` : ''}</option>
        ))}
      </select>
      </div>}

      {/* Tipo (multi) */}
      {showDataFilters && <div className="flex items-center gap-1.5 flex-wrap">
        <span className="w-20 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo</span>
        {(['TASK', 'BUG'] as ItemType[]).map(t => (
          <Tooltip key={t} label={TYPE_TOOLTIPS[t] ?? TYPE_LABELS[t] ?? t}>
            <button
              onClick={() => toggleType(t)}
              aria-pressed={filters.types.includes(t)}
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
      </div>}

      {/* Tags (multi) */}
      {showDataFilters && tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="w-20 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</span>
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              aria-pressed={filters.tagIds.includes(tag.id)}
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
      {showDataFilters && activeCount > 0 && (
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
