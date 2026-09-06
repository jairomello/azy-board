import { useTranslation } from 'react-i18next'

interface Props {
  sectionIds: string[]
  openIds: Set<string>
  onChange: (ids: Set<string>) => void
}

export function AccordionToolbar({ sectionIds, openIds, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label={t('accordion.controls')}>
      <button type="button" onClick={() => onChange(new Set(sectionIds))} className="rounded-md px-2 py-1 text-xs text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
        {t('accordion.expandAll')}
      </button>
      <button type="button" onClick={() => onChange(new Set())} className="rounded-md px-2 py-1 text-xs text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
        {t('accordion.collapseAll')}
      </button>
      <span className="sr-only">{openIds.size} / {sectionIds.length}</span>
    </div>
  )
}
