import { useTranslation } from 'react-i18next'

interface ChecklistSummaryProps {
  checked: number
  total: number
}

export function ChecklistSummary({ checked, total }: ChecklistSummaryProps) {
  const { t } = useTranslation()
  const percentage = total > 0 ? Math.round((checked / total) * 100) : 0

  return (
    <span className="inline-flex min-w-0 items-center gap-2" aria-label={t('accordion.checklistProgress', { checked, total })}>
      <span className="truncate">{t('accordion.checklistProgress', { checked, total })}</span>
      <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
      </span>
    </span>
  )
}

export function NeutralSummary({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation()
  return <span>{children ?? t('accordion.noAdditionalContent')}</span>
}
