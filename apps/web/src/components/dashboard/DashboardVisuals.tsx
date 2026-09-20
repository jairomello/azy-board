import { Suspense, lazy, type ComponentProps, type ReactNode } from 'react'

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

export function MetricValue({ label, value }: { label: string; value: string | number }) { return <div><span className="block text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-2xl tabular-nums text-foreground">{value}</strong></div> }
export function ChartLegend({ items }: { items: string[] }) { return <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{items.map((item, index) => <span key={item}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{item}</span>)}</div> }
export function ChartSkeleton() { return <div className="h-36 animate-pulse rounded-lg bg-muted" role="status" aria-label="Loading chart" /> }
export function ChartEmptyState({ children = 'No data available for this view' }: { children?: ReactNode }) { return <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground" role="status">{children}</div> }
export function DashboardCard({ title, icon: Icon, children, state = 'ready', partial, message, onRetry, description }: { title: string; icon: React.ComponentType<{ className?: string }>; children: ReactNode; state?: string; partial?: boolean; message?: ReactNode; onRetry?: () => void; description: string }) { return <section className="dashboard-box flex min-h-[330px] flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm" aria-labelledby={`dashboard-${title}`}><div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div className="min-w-0"><h2 id={`dashboard-${title}`} className="font-semibold text-foreground">{title}</h2>{partial && <span className="text-[11px] text-amber-700 dark:text-amber-300">Partial coverage</span>}</div></div>{state === 'loading' ? <ChartSkeleton /> : state === 'empty' || state === 'inapplicable' ? <ChartEmptyState>{message ?? (state === 'inapplicable' ? 'This filter does not apply to this view.' : undefined)}</ChartEmptyState> : state === 'error' ? <div className="text-sm text-destructive" role="alert">Unable to load this view. {onRetry && <button className="font-semibold underline" onClick={onRetry}>Retry</button>}</div> : <div className="min-h-0 flex-1">{children}</div>}<p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{description}</p></section> }

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
