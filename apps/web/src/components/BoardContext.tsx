import { Cloud, CloudOff, LoaderCircle, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type SyncState = 'connecting' | 'synced' | 'offline'

interface BoardContextHeaderProps {
  sprintName?: string
  completed: number
  total: number
}

export function BoardContextHeader({ sprintName, completed, total }: BoardContextHeaderProps) {
  const { t } = useTranslation('board')
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center gap-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Target className="w-[18px] h-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{sprintName ?? t('generalProgress')}</p>
        <p className="text-xs text-muted-foreground">
          {total > 0 ? `${completed} de ${total} itens concluídos` : 'Nenhum item no recorte atual'}
        </p>
      </div>
      <div className="ml-auto hidden min-[480px]:flex items-center gap-3 min-w-[120px] max-w-xs w-1/3">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
          <div className="h-full rounded-full bg-status-done transition-all" style={{ width: `${percentage}%` }} />
        </div>
        <span className="text-xs font-semibold tabular-nums text-foreground">{percentage}%</span>
      </div>
    </section>
  )
}

export function BoardStatusRail({ syncState, visibleItems }: { syncState: SyncState; visibleItems: number }) {
  const { t } = useTranslation('board')
  const config = {
    connecting: { label: t('connecting'), icon: LoaderCircle, className: 'text-amber-600 animate-spin' },
    synced: { label: t('synced'), icon: Cloud, className: 'text-status-done' },
    offline: { label: t('offline'), icon: CloudOff, className: 'text-status-blocked' },
  }[syncState]
  const Icon = config.icon

  return (
    <div className="h-8 px-3 flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Icon className={`w-3.5 h-3.5 ${config.className}`} />
        {config.label}
      </span>
      <span className="w-px h-3 bg-border" />
      <span>{t('realtimeUpdates')}</span>
      <span className="ml-auto tabular-nums">{t(visibleItems === 1 ? 'visibleItemOne' : 'visibleItemMany', { count: visibleItems })}</span>
    </div>
  )
}
