import { Suspense, lazy, useState, type ComponentProps, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Recharts é pesado (~449 KB no build baseline) e só é necessário quando o
// Dashboard renderiza gráficos. Os componentes abaixo são carregados sob
// demanda para manter o Recharts fora do bundle inicial e do chunk do board.
const charts = {
  Gauge: lazy(() => import('./DashboardCharts').then(module => ({ default: module.Gauge }))),
  Donut: lazy(() => import('./DashboardCharts').then(module => ({ default: module.Donut }))),
  DonutComparison: lazy(() => import('./DashboardCharts').then(module => ({ default: module.DonutComparison }))),
  HorizontalRankingBar: lazy(() => import('./DashboardCharts').then(module => ({ default: module.HorizontalRankingBar }))),
  SimpleBars: lazy(() => import('./DashboardCharts').then(module => ({ default: module.SimpleBars }))),
  TimeArea: lazy(() => import('./DashboardCharts').then(module => ({ default: module.TimeArea }))),
}

export const COLORS = ['var(--dashboard-series-scope)', 'var(--dashboard-series-done)', 'var(--dashboard-series-warning)', 'var(--dashboard-series-danger)', 'var(--dashboard-series-neutral)']

export function InfoHint({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Info aria-hidden className="h-3 w-3" />
      </button>
      {open && <span role="tooltip" className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[80vw] rounded-lg border border-border bg-surface p-2 text-left text-xs font-normal leading-relaxed text-foreground shadow-lg">{text}</span>}
    </span>
  )
}

export function MetricValue({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  const { t } = useTranslation('dashboard')
  return <div><span className="flex items-center gap-1 text-xs text-muted-foreground">{label}{hint && <InfoHint text={hint} label={t('howToRead', { metric: label })} />}</span><strong className="mt-1 block text-2xl tabular-nums text-foreground">{value}</strong></div>
}
export function ChartLegend({ items }: { items: string[] }) { return <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{items.map((item, index) => <span key={item}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{item}</span>)}</div> }
export function ChartSkeleton() { const { t } = useTranslation('dashboard'); return <div className="h-36 animate-pulse rounded-lg bg-muted" role="status" aria-label={t('loadingChart')} /> }
export function ChartEmptyState({ children }: { children?: ReactNode }) { const { t } = useTranslation('dashboard'); return <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground" role="status">{children ?? t('noData')}</div> }
export function DashboardCard({ title, icon: Icon, children, state = 'ready', partial, message, onRetry, description }: { title: string; icon: React.ComponentType<{ className?: string }>; children: ReactNode; state?: string; partial?: boolean; message?: ReactNode; onRetry?: () => void; description: string }) { const { t } = useTranslation('dashboard'); return <section className={`dashboard-box flex ${state === 'empty' || state === 'inapplicable' ? 'min-h-[150px]' : 'min-h-[330px]'} flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm`} aria-labelledby={`dashboard-${title}`}><div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div className="min-w-0"><div className="flex items-center gap-1.5"><h2 id={`dashboard-${title}`} className="font-semibold text-foreground">{title}</h2><InfoHint text={description} label={t('howToRead', { metric: title })} /></div>{partial && <span className="text-[11px] text-amber-700 dark:text-amber-300">{t('partialCoverage')}</span>}</div></div>{state === 'loading' ? <ChartSkeleton /> : state === 'empty' || state === 'inapplicable' ? <ChartEmptyState>{message ?? (state === 'inapplicable' ? t('filterNotApplicable') : undefined)}</ChartEmptyState> : state === 'error' ? <div className="text-sm text-destructive" role="alert">{t('loadViewError')} {onRetry && <button className="font-semibold underline" onClick={onRetry}>{t('retry')}</button>}</div> : <div className="min-h-0 flex-1">{children}</div>}</section> }

type ChartProps<T extends React.ElementType> = ComponentProps<T>

function LazyChart({ chart: Chart, props }: { chart: React.ComponentType<Record<string, unknown>>; props: Record<string, unknown> }) {
  return <Suspense fallback={<ChartSkeleton />}><Chart {...props} /></Suspense>
}

function asLazyChart(component: unknown): React.ComponentType<Record<string, unknown>> {
  return component as React.ComponentType<Record<string, unknown>>
}

export function Gauge(props: ChartProps<typeof charts.Gauge>) { return <LazyChart chart={asLazyChart(charts.Gauge)} props={props as unknown as Record<string, unknown>} /> }
export function Donut(props: ChartProps<typeof charts.Donut>) { return <LazyChart chart={asLazyChart(charts.Donut)} props={props as unknown as Record<string, unknown>} /> }
export function DonutComparison(props: ChartProps<typeof charts.DonutComparison>) { return <LazyChart chart={asLazyChart(charts.DonutComparison)} props={props as unknown as Record<string, unknown>} /> }
export function HorizontalRankingBar(props: ChartProps<typeof charts.HorizontalRankingBar>) { return <LazyChart chart={asLazyChart(charts.HorizontalRankingBar)} props={props as unknown as Record<string, unknown>} /> }
export function SimpleBars(props: ChartProps<typeof charts.SimpleBars>) { return <LazyChart chart={asLazyChart(charts.SimpleBars)} props={props as unknown as Record<string, unknown>} /> }
export function TimeArea(props: ChartProps<typeof charts.TimeArea>) { return <LazyChart chart={asLazyChart(charts.TimeArea)} props={props as unknown as Record<string, unknown>} /> }
