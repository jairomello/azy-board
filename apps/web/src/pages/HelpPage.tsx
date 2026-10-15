// Central de ajuda: manual funcional do Azy Board servido pela API autenticada.
//
// O conteúdo vem de `docs/azyboard-wiki` (mesma fonte do agente) e o índice de
// tópicos é derivado da estrutura do manual. Cada página é buscada sob demanda,
// então nenhuma biblioteca nova entra no bundle.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppShell } from '../components/AppShell'
import { api, type HelpIndexResponse, type HelpPageResponse } from '../lib/api'
import { appBasePath } from '../lib/appUrl'
import { helpSlugFromHref, renderHelpMarkdown } from '../lib/helpMarkdown'

export default function HelpPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { slug } = useParams<{ slug?: string }>()
  const basePath = appBasePath()
  const contentRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState<HelpIndexResponse | null>(null)
  const [indexError, setIndexError] = useState(false)
  const [page, setPage] = useState<HelpPageResponse | null>(null)
  const [pageError, setPageError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIndexError(false)
    api.help.index()
      .then(result => { if (!cancelled) setIndex(result) })
      .catch(() => { if (!cancelled) setIndexError(true) })
    return () => { cancelled = true }
  }, [reloadToken])

  const activeSlug = slug ?? index?.home?.slug ?? index?.modules[0]?.pages[0]?.slug ?? null

  useEffect(() => {
    if (!activeSlug) {
      setPage(null)
      return
    }
    let cancelled = false
    setPageError(false)
    setPage(current => (current?.slug === activeSlug ? current : null))
    api.help.page(activeSlug)
      .then(result => { if (!cancelled) setPage(result) })
      .catch(() => { if (!cancelled) setPageError(true) })
    return () => { cancelled = true }
  }, [activeSlug, reloadToken])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [page?.slug])

  const html = useMemo(() => (page ? renderHelpMarkdown(page.markdown, { basePath }) : ''), [page, basePath])

  // Links internos da ajuda navegam pelo router; o `href` real permanece para
  // abrir em nova aba ou copiar o endereço.
  function handleContentClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    const internalSlug = helpSlugFromHref(anchor.getAttribute('href'), basePath)
    if (!internalSlug) return
    event.preventDefault()
    navigate(`/help/${internalSlug}`)
  }

  function retry() {
    setReloadToken(token => token + 1)
  }

  const topics = index?.modules ?? []

  return (
    <AppShell sectionLabel={t('help.title')} contextLabel={t('help.title')} contentClassName="overflow-hidden">
      <div className="h-full min-h-0 flex flex-col lg:flex-row">
        <nav
          aria-label={t('help.topics')}
          className="lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto px-4 py-4 lg:py-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">{t('help.topics')}</p>
          {indexError ? (
            <p className="text-sm text-muted-foreground">{t('help.error')}</p>
          ) : !index ? (
            <p className="text-sm text-muted-foreground">{t('help.loading')}</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('help.empty')}</p>
          ) : (
            <ul className="space-y-4">
              {topics.map(module => (
                <li key={module.id}>
                  <p className="text-sm font-semibold text-foreground">{module.title}</p>
                  <ul className="mt-1 space-y-0.5">
                    {module.pages.map(topic => (
                      <li key={topic.slug}>
                        <button
                          type="button"
                          onClick={() => navigate(`/help/${topic.slug}`)}
                          aria-current={topic.slug === activeSlug ? 'page' : undefined}
                          className={`w-full text-left text-sm rounded-md px-2 py-1 transition-colors ${
                            topic.slug === activeSlug
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {topic.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
          <div className="max-w-3xl mx-auto">
            {indexError ? (
              <div className="rounded-lg border border-border p-6">
                <p className="text-sm text-foreground">{t('help.error')}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  {t('help.retry')}
                </button>
              </div>
            ) : pageError ? (
              <div className="rounded-lg border border-border p-6">
                <p className="text-sm text-foreground">{t('help.error')}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  {t('help.retry')}
                </button>
              </div>
            ) : !page ? (
              <p className="text-sm text-muted-foreground">{t('help.loading')}</p>
            ) : (
              <article>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{page.moduleTitle ?? t('help.title')}</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mt-1 mb-4">{page.title}</h2>
                <div
                  className="prose prose-sm sm:prose-base max-w-none dark:prose-invert"
                  onClick={handleContentClick}
                  // Conteúdo gerado por `renderHelpMarkdown`, que escapa HTML cru e
                  // filtra protocolos de link/imagem (regras de `lib/richText.ts`).
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </article>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
