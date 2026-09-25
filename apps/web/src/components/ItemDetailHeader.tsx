import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ItemType } from '@azy-board/domain'
import { InlineEdit } from './InlineEdit'
import { itemTypeMeta } from '../lib/itemTypeMeta'

interface Props {
  titleId: string
  type: ItemType
  title: string
  onTitleChange: (value: string) => void
  placeholder: string
  breadcrumb: Array<{ title: string }>
  sequenceCode?: string | null
  statusLabel?: string
  autoEdit?: boolean
  onBack?: () => void
}

// Cabeçalho contextual das modais de item: breadcrumb, ícone do tipo,
// título editável inline e badges de tipo/status/código.
export function ItemDetailHeader({
  titleId,
  type,
  title,
  onTitleChange,
  placeholder,
  breadcrumb,
  sequenceCode,
  statusLabel,
  autoEdit = false,
  onBack,
}: Props) {
  const { t } = useTranslation('board')
  const typeMeta = itemTypeMeta(type)
  const TypeIcon = typeMeta.icon

  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t('boardContext')}</span>
          <ChevronRight className="h-3 w-3" />
          {breadcrumb.slice(-2).map((node, index) => (
            <span key={`${node.title}-${index}`} className="flex items-center gap-2">
              <span className="max-w-32 truncate">{node.title}</span>
              <ChevronRight className="h-3 w-3" />
            </span>
          ))}
          <span>{sequenceCode || title}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeMeta.iconClass}`}>
            <TypeIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-foreground sm:text-lg">
              <InlineEdit value={title} onSave={onTitleChange} autoEdit={autoEdit} placeholder={placeholder} />
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-medium ${typeMeta.chipClass}`}>{t(typeMeta.labelKey)}</span>
              {statusLabel && <span className="rounded bg-muted px-1.5 py-0.5">{statusLabel}</span>}
              {sequenceCode && <span className="text-muted-foreground">#{sequenceCode}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
