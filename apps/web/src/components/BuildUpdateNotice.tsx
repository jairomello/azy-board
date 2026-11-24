import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X } from 'lucide-react'
import { fetchPublishedBuildInfo, getBuildInfo, isUpdateAvailable, type PublishedBuildInfo } from '../lib/buildInfo'

const POLL_INTERVAL_MS = 5 * 60_000

interface BuildUpdateNoticeProps {
  /** Versão embutida no bundle; injetável para teste. */
  currentVersion?: string
  /** Consulta da versão publicada; injetável para teste. */
  check?: () => Promise<PublishedBuildInfo | null>
  /** Ação de recarregar; injetável para teste. */
  reload?: () => void
  pollIntervalMs?: number
}

function reloadPage(): void {
  globalThis.location.reload()
}

/**
 * Aviso não bloqueante de build publicado mais novo que o bundle em uso.
 *
 * A checagem também roda em `visibilitychange`: a aba que ficou horas em segundo
 * plano é exatamente o caso em que o deploy aconteceu no meio. Falha de rede é
 * silenciosa e a próxima checagem tenta de novo.
 */
export function BuildUpdateNotice({
  currentVersion,
  check = fetchPublishedBuildInfo,
  reload = reloadPage,
  pollIntervalMs = POLL_INTERVAL_MS,
}: BuildUpdateNoticeProps = {}) {
  const { t } = useTranslation('common')
  const version = currentVersion ?? getBuildInfo().version
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  useEffect(() => {
    if (version === 'dev') return

    let active = true
    const run = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const published = await check()
        if (active && published && isUpdateAvailable(version, published.version)) {
          setPublishedVersion(published.version)
        }
      } catch {
        // Rede instável ou resposta que não é JSON: tenta no próximo ciclo.
      }
    }

    void run()
    const timer = setInterval(() => { void run() }, pollIntervalMs)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [version, check, pollIntervalMs])

  if (!publishedVersion || publishedVersion === dismissedVersion) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-build-update-notice
      className="fixed bottom-4 left-1/2 z-[210] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-lg"
    >
      <span>{t('buildUpdateAvailable', { version: publishedVersion })}</span>
      <button
        type="button"
        onClick={reload}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {t('buildUpdateReload')}
      </button>
      <button
        type="button"
        onClick={() => setDismissedVersion(publishedVersion)}
        aria-label={t('buildUpdateDismiss')}
        title={t('buildUpdateDismiss')}
        className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
