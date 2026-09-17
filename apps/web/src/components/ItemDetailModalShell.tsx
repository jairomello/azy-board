import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  titleId: string
  onClose: () => void
  header: ReactNode
  tabs: ReactNode
  footer: ReactNode
  children: ReactNode
  zIndex?: number
}

// Casca ampla e responsiva das modais de detalhe: cabeçalho e rodapé fixos,
// rolagem apenas no conteúdo e grade com área principal + painel lateral.
export function ItemDetailModalShell({
  titleId,
  onClose,
  header,
  tabs,
  footer,
  children,
  zIndex = 50,
}: Props) {
  const { t } = useTranslation('board')

  return (
    <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4" style={{ zIndex }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="item-modal-frame relative flex w-full max-w-[1120px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          {header}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={t('cancel')}
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <nav
          role="tablist"
          aria-label={t('itemAreasLabel')}
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 sm:px-6"
        >
          {tabs}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">{children}</div>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </footer>
      </section>
    </div>
  )
}
