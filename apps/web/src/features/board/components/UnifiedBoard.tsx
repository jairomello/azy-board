// Kanban unificado: uma única faixa de colunas para todas as atividades do
// recorte. Diferente das lanes (módulo → épico → história), aqui a população é
// exatamente o resultado dos filtros, então o mesmo card aparece uma única vez e
// o contexto de origem continua no breadcrumb do próprio card.
import { useTranslation } from 'react-i18next'
import type { ProjectVersion } from '../../../components/ItemModal'
import { BoardColumns } from './BoardColumns'
import type { Column, ItemData, Sprint } from '../model/types'

interface UnifiedBoardProps {
  cards: ItemData[]
  columns: Column[]
  versions: ProjectVersion[]
  sprints: Sprint[]
  /** Projeto ainda sem itens: o CTA de criação do Board já explica o próximo passo. */
  emptyProject?: boolean
  onQuickAdd: (columnId: string) => void
  onOpenDetail: (id: string) => void
  onTitleSave: (id: string, title: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  criticalIds?: ReadonlySet<string> | null
}

export function UnifiedBoard({
  cards,
  columns,
  versions,
  sprints,
  emptyProject = false,
  onQuickAdd,
  onOpenDetail,
  onTitleSave,
  onDelete,
  onArchive,
  criticalIds = null,
}: UnifiedBoardProps) {
  const { t } = useTranslation('board')
  return (
    <section className="unified-board rounded-xl border border-border/80 bg-surface p-2.5 sm:p-3 shadow-sm" data-board-layout="unified">
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <span className="text-sm font-semibold text-foreground">{t('viewUnified')}</span>
        <span className="text-[11px] text-muted-foreground" data-unified-count={cards.length}>
          {t('unifiedBoardCount', { count: cards.length })}
        </span>
        {cards.length === 0 && !emptyProject && (
          <span className="text-[11px] text-muted-foreground">{t('unifiedBoardHint')}</span>
        )}
      </header>
      <BoardColumns
        laneId="unified"
        columns={columns}
        versions={versions}
        sprints={sprints}
        tasks={cards}
        allowAdd
        columnAddForms={{}}
        onShowAddForm={() => undefined}
        onHideAddForm={() => undefined}
        onCardCreate={async () => undefined}
        onQuickAdd={onQuickAdd}
        onOpenDetail={onOpenDetail}
        onTitleSave={onTitleSave}
        onDelete={onDelete}
        onArchive={onArchive}
        criticalIds={criticalIds}
      />
    </section>
  )
}
