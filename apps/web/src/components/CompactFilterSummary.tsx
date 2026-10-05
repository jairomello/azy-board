import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Filter } from 'lucide-react'
import { ActiveFilterChips, normalizeActiveBoardFilters, type ActiveFilterCatalogs, type ActiveFilterKey, type ActiveFilterLabels, type ActiveFilterVisualContext } from './ActiveFilterChips'
import type { BoardFilterState } from './BoardFilters'

interface Props {
  filters: BoardFilterState
  catalogs: ActiveFilterCatalogs
  labels: ActiveFilterLabels
  visualContext?: ActiveFilterVisualContext
  onRemove: (key: ActiveFilterKey, value?: string) => void
}

// Card T33 — resumo compacto dos filtros ativos: um controle na barra que abre a
// lista completa (com a mesma remoção individual) no modo de densidade compacta.
export function CompactFilterSummary({ filters, catalogs, labels, visualContext, onRemove }: Props) {
  const { t } = useTranslation('board')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = normalizeActiveBoardFilters(filters, catalogs, labels, visualContext)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  if (active.length === 0) return null

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('filtersSummary', { count: active.length })}
        title={t('filtersSummary', { count: active.length })}
        onClick={() => setOpen(value => !value)}
        className="h-9 rounded-lg border border-primary/40 bg-background px-2.5 text-xs font-medium text-primary hover:bg-muted transition-colors flex items-center gap-2"
      >
        <Filter className="w-3.5 h-3.5" />
        <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[10px]">
          {active.length}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 w-[min(640px,calc(100vw-2rem))] rounded-xl border border-border bg-popover shadow-2xl p-3">
          <ActiveFilterChips filters={filters} catalogs={catalogs} labels={labels} visualContext={visualContext} onRemove={onRemove} />
        </div>
      )}
    </div>
  )
}
