// Campo de busca de cards no header do board (T92).
//
// O componente é controlado: a tela calcula os resultados (já combinados com
// os filtros ativos) e ele cuida de teclado, foco, dropdown e acessibilidade.
// Nenhuma chamada HTTP acontece aqui.
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bug, CheckSquare, Search, X } from 'lucide-react'
import type { TaskStatus } from '@azy-board/domain'
import type { CardSearchItem } from '../features/board/model/cardSearchMatch'
import { getCardSearchBreadcrumb, type CardSearchResult } from '../features/board/model/cardSearchRank'

interface CardSearchProps<T extends CardSearchItem> {
  query: string
  onQueryChange: (value: string) => void
  results: CardSearchResult<T>[]
  total: number
  onSelect: (item: T) => void
  loading?: boolean
}

const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"]'

export function CardSearch<T extends CardSearchItem>({
  query,
  onQueryChange,
  results,
  total,
  onSelect,
  loading = false,
}: CardSearchProps<T>) {
  const { t } = useTranslation('board')
  const statusLabels: Record<TaskStatus, string> = {
    NOT_STARTED: t('statusNotStarted'),
    PLANNED: t('statusPlanned'),
    IN_PROGRESS: t('statusInProgress'),
    IN_HOMOLOGATION: t('statusInHomologation'),
    BLOCKED: t('statusBlocked'),
    DONE: t('statusDone'),
    CANCELLED: t('statusCancelled'),
    ARCHIVED: t('statusCancelled'),
  }
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const hasQuery = query.trim().length > 0
  const showResults = open && hasQuery
  const activeResult = results[activeIndex]
  const optionId = (index: number) => `${listboxId}-option-${index}`

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (mobileOpen) mobileInputRef.current?.focus()
  }, [mobileOpen])

  useEffect(() => {
    if (!open && !mobileOpen) return
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setMobileOpen(false)
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      setMobileOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, mobileOpen])

  useEffect(() => {
    function focusShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey) return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLocaleLowerCase('pt-BR') !== 'k') return
      // Não rouba foco de uma modal aberta (edição de card, exportação etc.).
      if (document.querySelector(MODAL_SELECTOR)) return
      event.preventDefault()
      if (window.matchMedia('(min-width: 768px)').matches) {
        inputRef.current?.focus()
        inputRef.current?.select()
        if (query.trim()) setOpen(true)
      } else {
        setMobileOpen(true)
      }
    }
    window.addEventListener('keydown', focusShortcut)
    return () => window.removeEventListener('keydown', focusShortcut)
  }, [query])

  function handleChange(value: string) {
    onQueryChange(value)
    setOpen(true)
    setActiveIndex(0)
  }

  function clear() {
    const wasMobile = mobileOpen
    onQueryChange('')
    setOpen(false)
    setMobileOpen(false)
    if (!wasMobile) inputRef.current?.focus()
  }

  function select(item: T) {
    onSelect(item)
    setOpen(false)
    setMobileOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      if (results.length > 0) setActiveIndex(current => (current + 1) % results.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      if (results.length > 0) setActiveIndex(current => (current - 1 + results.length) % results.length)
      return
    }
    if (event.key === 'Enter' && showResults && activeResult) {
      event.preventDefault()
      select(activeResult.item)
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
      setMobileOpen(false)
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
      setMobileOpen(false)
    }
  }

  function searchInput(tone: 'shell' | 'surface', ref: React.RefObject<HTMLInputElement>, autoFocus = false) {
    const shell = tone === 'shell'
    return (
      <div className="relative">
        <Search
          className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${shell ? 'text-shell-muted' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="text"
          inputMode="search"
          autoComplete="off"
          value={query}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={showResults && results.length > 0 ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showResults && activeResult ? optionId(activeIndex) : undefined}
          aria-label={t('cardSearchLabel')}
          placeholder={t('cardSearchPlaceholder')}
          title={t('cardSearchShortcutHint')}
          onChange={event => handleChange(event.target.value)}
          onFocus={() => { if (hasQuery) setOpen(true) }}
          onKeyDown={handleKeyDown}
          className={`h-9 w-full rounded-lg border pl-8 pr-8 text-sm outline-none transition focus:ring-2 ${
            shell
              ? 'border-white/15 bg-white/10 text-shell-foreground placeholder:text-shell-muted focus:border-primary/60 focus:ring-primary/30'
              : 'border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/30'
          }`}
        />
        {hasQuery && (
          <button
            type="button"
            onClick={clear}
            aria-label={t('cardSearchClear')}
            title={t('cardSearchClear')}
            className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition ${
              shell ? 'text-shell-muted hover:bg-white/10 hover:text-shell-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  function resultsPanel(tone: 'shell' | 'surface') {
    if (!hasQuery) return null
    const shell = tone === 'shell'
    return (
      <div
        className={`mt-2 overflow-hidden rounded-xl border shadow-2xl ${
          shell ? 'border-shell-border bg-popover text-foreground' : 'border-border bg-popover text-foreground'
        }`}
      >
        {loading ? (
          <p className="px-3 py-3 text-xs text-muted-foreground" role="status">{t('cardSearchLoading')}</p>
        ) : results.length === 0 ? (
          <div className="px-3 py-3" role="status">
            <p className="text-xs font-medium text-foreground">{t('cardSearchNoResults', { query })}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t('cardSearchNoResultsHint')}</p>
            <button
              type="button"
              onClick={clear}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              {t('cardSearchClearAction')}
            </button>
          </div>
        ) : (
          <>
            <div id={listboxId} role="listbox" aria-label={t('cardSearchResultsLabel')} className="max-h-80 overflow-y-auto p-1">
              {results.map((result, index) => {
                const item = result.item
                const Icon = item.type === 'BUG' ? Bug : CheckSquare
                const breadcrumb = getCardSearchBreadcrumb(item)
                const assignee = item.assignee?.name ?? item.assigneeLabel ?? ''
                const statusLabel = item.status ? statusLabels[item.status] : null
                return (
                  <div
                    key={item.id}
                    id={optionId(index)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(item)}
                    className={`cursor-pointer rounded-lg px-2.5 py-2 transition ${
                      index === activeIndex ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 min-w-10 flex-shrink-0 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                        {item.sequenceCode ?? ''}
                      </span>
                      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          {statusLabel && <span className="flex-shrink-0">{statusLabel}</span>}
                          {breadcrumb && <><span aria-hidden>·</span><span className="truncate">{breadcrumb}</span></>}
                          {assignee && <><span aria-hidden>·</span><span className="truncate">{assignee}</span></>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
              <span aria-live="polite">
                {total > results.length
                  ? t('cardSearchShowing', { shown: results.length, total })
                  : t('cardSearchResultsCount', { count: total })}
              </span>
              <span className="hidden sm:inline">{t('cardSearchOpenHint')}</span>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="hidden w-44 md:block lg:w-64">
        {searchInput('shell', inputRef)}
        {showResults && (
          <div className="absolute right-0 top-full z-50 w-[min(30rem,calc(100vw-2rem))]">
            {resultsPanel('shell')}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t('cardSearchLabel')}
        title={t('cardSearchLabel')}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-shell-muted transition hover:bg-white/10 hover:text-shell-foreground md:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      {mobileOpen && (
        <div className="fixed left-3 right-3 top-20 z-50 md:hidden">
          <div className="rounded-xl border border-border bg-popover p-3 text-foreground shadow-2xl">
            {searchInput('surface', mobileInputRef, true)}
            {showResults && resultsPanel('surface')}
          </div>
        </div>
      )}
    </div>
  )
}
