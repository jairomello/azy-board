import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, AlertCircle, BarChart3, Clock3, Cloud, CloudOff, Filter, ListTodo, RefreshCw, Users } from 'lucide-react'
import type { WsEvent, WsEventType } from '@azy-board/realtime-contracts'
import type { DashboardAging, DashboardBurnup, DashboardFilters, DashboardHours, DashboardItemDetail, DashboardSnapshot, DashboardState } from '@azy-board/ui-contracts'
import { AppShell } from '../components/AppShell'
import { formatDate } from '../lib/formatters'
import { api } from '../lib/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../lib/queryKeys'
import { buildDashboardHandlers } from '../lib/realtimeEvents'
import { useWebSocket } from '../hooks/useWebSocket'
import { burnupData, hoursByAuthorData, progressData, rankingData, statusData, teamLoadData } from '../dashboardAdapters'
import { ChartEmptyState, ChartLegend, DashboardCard, Donut, DonutComparison, Gauge, HorizontalRankingBar, MetricValue, SimpleBars, TimeArea } from '../components/dashboard/DashboardVisuals'

type Option = { id: string; name: string }
type Catalogs = { modules: Option[]; sprints: Option[]; versions: Option[]; squads: Option[]; members: Option[] }
const initialFilters: DashboardFilters = { from: '', to: '', moduleId: '', sprintId: '', versionId: '', squadId: '', assigneeId: '', type: '' }

function queryString(filters: DashboardFilters) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value); return params.toString() }
function Box(props: { title: string; icon: typeof Activity; state?: DashboardState; children: ReactNode; partial?: boolean; t: (key: string) => string; description: string; onRetry?: () => void; message?: ReactNode }) { return <DashboardCard {...props} /> }
function ItemModal({ item, projectId, t, onClose }: { item: DashboardItemDetail | null; projectId: string; t: (key: string) => string; onClose: () => void }) { useEffect(() => { if (!item) return; const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [item, onClose]); if (!item) return null; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="dashboard-item-title"><div className="flex items-start justify-between gap-4"><h2 id="dashboard-item-title" className="text-lg font-semibold">{item.title}</h2><button autoFocus type="button" className="text-sm underline" onClick={onClose}>{t('close')}</button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">ID</dt><dd className="break-all">{item.id}</dd><dt className="text-muted-foreground">{t('type')}</dt><dd>{item.type ?? '—'}</dd><dt className="text-muted-foreground">{t('status')}</dt><dd>{item.status ?? '—'}</dd><dt className="text-muted-foreground">{t('reason')}</dt><dd>{item.blockedReason || '—'}</dd><dt className="text-muted-foreground">{t('assignee')}</dt><dd>{item.assigneeName || item.assigneeId || '—'}</dd><dt className="text-muted-foreground">{t('age')}</dt><dd>{item.blockedAgeDays != null ? `${Math.round(item.blockedAgeDays)} ${t('days')}` : item.ageHours != null ? `${Math.round(item.ageHours / 24)} ${t('days')}` : '—'}{item.minimumKnown ? ` (${t('minimumKnown')})` : ''}</dd></dl><Link className="mt-5 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" to={`/projects/${projectId}/board?itemId=${item.id}`}>{t('openBoard')}</Link></section></div> }
function OverdueModal({ selection, projectId, t, onClose }: { selection: { metric: 'items' | 'points'; items: DashboardItemDetail[] } | null; projectId: string; t: (key: string) => string; onClose: () => void }) { const closeRef = useRef<HTMLButtonElement>(null); useEffect(() => { if (!selection) return; closeRef.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [selection, onClose]); if (!selection) return null; const metric = selection.metric === 'points' ? t('points') : t('items'); return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5" role="dialog" aria-modal="true" aria-labelledby="overdue-modal-title"><div className="flex justify-between gap-4"><h2 id="overdue-modal-title" className="font-semibold">{t('overdueItems')} · {metric}</h2><button ref={closeRef} type="button" className="underline" onClick={onClose}>{t('close')}</button></div><ul className="mt-3 space-y-2">{selection.items.length ? selection.items.map(item => <li key={item.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{item.title}{selection.metric === 'points' && item.points != null ? ` · ${item.points} ${t('points')}` : ''}</span><Link className="shrink-0 text-primary underline" to={`/projects/${projectId}/board?itemId=${item.id}`}>{t('openBoard')}</Link></li>) : <li className="text-sm text-muted-foreground">{t('noData')}</li>}</ul></section></div> }

export default function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>(); const { t } = useTranslation('dashboard')
  const [filters, setFilters] = useState<DashboardFilters>(() => { try { return { ...initialFilters, ...JSON.parse(localStorage.getItem(`dashboard-filters:${projectId}`) ?? '{}') } } catch { return initialFilters } })
  const [burnupMode, setBurnupMode] = useState<'items' | 'points'>('items'); const [teamLoadMode, setTeamLoadMode] = useState<'items' | 'points'>('items'); const [selectedItem, setSelectedItem] = useState<DashboardItemDetail | null>(null); const [overdueModal, setOverdueModal] = useState<{ metric: 'items' | 'points'; items: DashboardItemDetail[] } | null>(null)
  const qs = queryString(filters)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = useMemo(() => queryKeys.dashboard(user?.id, projectId, qs), [user?.id, projectId, qs])
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(projectId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async ({ signal }) => {
      const pid = projectId as string
      const suffix = qs ? `?${qs}` : ''
      const results = await Promise.allSettled([
        api.get<DashboardSnapshot>(`/projects/${pid}/dashboard/snapshot${suffix}`, { signal }),
        api.get<DashboardBurnup>(`/projects/${pid}/dashboard/burnup${suffix}`, { signal }),
        api.get<DashboardAging>(`/projects/${pid}/dashboard/aging${suffix}`, { signal }),
        api.get<DashboardHours>(`/projects/${pid}/dashboard/hours${suffix}`, { signal }),
        api.get<{ name: string }>(`/projects/${pid}`, { signal }),
        api.get<Option[]>(`/projects/${pid}/modules`, { signal }),
        api.get<Option[]>(`/projects/${pid}/sprints`, { signal }),
        api.get<Option[]>(`/projects/${pid}/versions`, { signal }),
        api.get<Option[]>(`/projects/${pid}/squads`, { signal }),
        api.get<Option[]>(`/projects/${pid}/members`, { signal }),
      ])
      const states: Record<string, DashboardState> = {}
      const pick = <T,>(index: number, box: string): T | null => { const result = results[index]; if (result?.status === 'fulfilled') { states[box] = 'ready'; return result.value as T } states[box] = 'error'; return null }
      return {
        snapshot: pick<DashboardSnapshot>(0, 'snapshot'),
        burnup: pick<DashboardBurnup>(1, 'burnup'),
        aging: pick<DashboardAging>(2, 'aging'),
        hours: pick<DashboardHours>(3, 'hours'),
        projectName: results[4]?.status === 'fulfilled' ? (results[4].value as { name: string }).name : '',
        catalogs: {
          modules: results[5]?.status === 'fulfilled' ? results[5].value as Option[] : [],
          sprints: results[6]?.status === 'fulfilled' ? results[6].value as Option[] : [],
          versions: results[7]?.status === 'fulfilled' ? results[7].value as Option[] : [],
          squads: results[8]?.status === 'fulfilled' ? results[8].value as Option[] : [],
          members: results[9]?.status === 'fulfilled' ? results[9].value as Option[] : [],
        },
        states,
      }
    },
  })
  const invalidateDashboard = () => { void queryClient.invalidateQueries({ queryKey: key }) }
  const snapshot = query.data?.snapshot ?? null
  const burnup = query.data?.burnup ?? null
  const aging = query.data?.aging ?? null
  const hours = query.data?.hours ?? null
  const projectName = query.data?.projectName ?? ''
  const catalogs = query.data?.catalogs ?? { modules: [], sprints: [], versions: [], squads: [], members: [] }
  const states = query.data?.states ?? { snapshot: query.isPending ? 'loading' : 'error', burnup: query.isPending ? 'loading' : 'error', aging: query.isPending ? 'loading' : 'error', hours: query.isPending ? 'loading' : 'error' }
  useEffect(() => { try { localStorage.setItem(`dashboard-filters:${projectId}`, JSON.stringify(filters)) } catch {} }, [filters, projectId])
  const sync = useWebSocket(projectId ?? null, buildDashboardHandlers(invalidateDashboard))
  const wasOfflineRef = useRef(false)
  useEffect(() => {
    if (sync === 'offline') wasOfflineRef.current = true
    else if (sync === 'synced' && wasOfflineRef.current) { wasOfflineRef.current = false; invalidateDashboard() }
  }, [sync]) // eslint-disable-line react-hooks/exhaustive-deps
  const update = (key: keyof DashboardFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value })); const filterFields = useMemo(() => [['from', 'date'], ['to', 'date'], ['moduleId', 'module'], ['sprintId', 'sprint'], ['versionId', 'version'], ['squadId', 'squad'], ['assigneeId', 'assignee'], ['type', 'type']] as const, []); const state = (key: string) => states[key] ?? 'error'; const coverage = snapshot?.coverage
  if (!projectId) return null
  const progress = snapshot ? progressData(snapshot) : null
  const teamLoad = snapshot ? teamLoadData(snapshot, teamLoadMode) : []
  const teamLoadHasWip = teamLoad.some(item => Number(item.value) > 0)
    return <AppShell projectId={projectId} projectName={projectName} sectionLabel={t('title')} contextLabel={projectName || t('title')} contentClassName="overflow-y-auto"><div className="mx-auto max-w-[1600px] px-3 py-5 sm:px-6 sm:py-7"><header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{projectName}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{t('title')}</h1><p className="mt-2 text-xs text-muted-foreground">{coverage?.startedAt ? t('coverage', { date: formatDate(coverage.startedAt) }) : t('unknownCoverage')}</p></div><div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs text-muted-foreground" aria-live="polite">{sync === 'synced' ? <Cloud className="h-4 w-4 text-status-done" /> : <CloudOff className="h-4 w-4 text-status-blocked" />}{sync === 'synced' ? t('synced') : sync}</div></header>
    <form className="mb-6 rounded-2xl border border-border bg-surface p-4" aria-label={t("filtersMenu")} onSubmit={event => event.preventDefault()}><div className="mb-3 flex items-center gap-2 text-xs font-semibold"><Filter className="h-4 w-4 text-primary" />{t('filtersMenu', { defaultValue: 'Filters' })}<button type="button" className="ml-auto text-primary underline" onClick={() => setFilters(initialFilters)}>{t('clear')}</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{filterFields.map(([key, label]) => <label key={key} className="text-xs text-muted-foreground">{t(label)}{key === 'from' || key === 'to' ? <input type="date" value={filters[key]} onChange={event => update(key, event.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground" /> : <select value={filters[key]} onChange={event => update(key, event.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground"><option value="">{t('all')}</option>{key === 'type' ? <><option value="TASK">{t('task')}</option><option value="BUG">{t('bug')}</option></> : (catalogs[key === 'moduleId' ? 'modules' : key === 'sprintId' ? 'sprints' : key === 'versionId' ? 'versions' : key === 'squadId' ? 'squads' : 'members']).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>}</label>)}</div><p className="mt-3 text-[11px] text-muted-foreground">{t('inapplicablePeriod')} · {t('inapplicablePeople')}</p></form>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Box title={t('progressScope')} icon={BarChart3} description={t('descriptionProgressScope')} state={state('snapshot')} t={t}>{progress && <><div className="grid grid-cols-2 gap-2"><Gauge value={snapshot!.boxes.progressScope.done} total={snapshot!.boxes.progressScope.total} label={t('done')} /><Gauge value={snapshot!.boxes.progressScope.donePoints} total={snapshot!.boxes.progressScope.points} label={t('points')} unit={t('points')} /></div><p className="text-xs text-muted-foreground">{t('estimated')}: {snapshot!.boxes.progressScope.estimationCoverage === null ? '—' : `${Math.round(snapshot!.boxes.progressScope.estimationCoverage)}%`}</p></>}</Box>
        <Box title={t('wip')} icon={ListTodo} description={t('descriptionWip')} state={state('snapshot')} t={t}>{snapshot && <><div className="grid grid-cols-2 gap-2"><div><p className="mb-1 text-center text-xs font-semibold text-foreground">{t('wipByItems')}</p><Donut data={statusData(snapshot).map(item => ({ name: t(item.status === 'DONE' ? 'done' : item.status === 'IN_PROGRESS' ? 'inProgress' : item.status === 'BLOCKED' ? 'blockedStatus' : 'notStarted'), value: item.value }))} /><ChartLegend items={[t('done'), t('inProgress'), t('blockedStatus'), t('notStarted')]} /></div><div><p className="mb-1 text-center text-xs font-semibold text-foreground">{t('wipByPoints')}</p><Donut data={statusData(snapshot, 'points').map(item => ({ name: t(item.status === 'DONE' ? 'done' : item.status === 'IN_PROGRESS' ? 'inProgress' : item.status === 'BLOCKED' ? 'blockedStatus' : 'notStarted'), value: item.value }))} /><ChartLegend items={[t('done'), t('inProgress'), t('blockedStatus'), t('notStarted')]} /></div></div><p className="text-xs text-muted-foreground">{t('pointsCoverage')}: {snapshot.boxes.wip.pointsCoverage == null ? '—' : `${Math.round(snapshot.boxes.wip.pointsCoverage)}%`}</p></>}</Box>
        <Box title={t('blocked')} icon={AlertCircle} description={t('descriptionBlocked')} state={state('snapshot')} t={t}>{snapshot && <><MetricValue label={t('total')} value={snapshot.boxes.blocked.total} />{snapshot.boxes.blocked.items.length ? <HorizontalRankingBar data={rankingData(snapshot.boxes.blocked.items, 'blocked')} unit={t('days')} onSelect={id => setSelectedItem(snapshot.boxes.blocked.items.find(item => item.id === id) ?? null)} /> : <ChartEmptyState>{t('noData')}</ChartEmptyState>}</>}</Box>
         <Box title={t('overdue')} icon={Clock3} description={t('descriptionOverdue')} state={state('snapshot')} t={t}>{snapshot && progress && <><MetricValue label={t('total')} value={snapshot.boxes.overdue.total} /><div className="grid grid-cols-2 gap-2"><DonutComparison title={t('overdueItems')} selected={snapshot.boxes.overdue.total} total={progress.total} selectedLabel={t('overdue')} totalLabel={t("remaining")} onSliceClick={index => setOverdueModal({ metric: 'items', items: index === 0 ? snapshot.boxes.overdue.items : snapshot.boxes.overdue.remainingItems })} /><DonutComparison title={t('overduePoints')} selected={snapshot.boxes.overdue.items.reduce((sum, item) => sum + (item.points ?? 0), 0)} total={progress.points} selectedLabel={t('overdue')} totalLabel={t("remaining")} onSliceClick={index => setOverdueModal({ metric: 'points', items: (index === 0 ? snapshot.boxes.overdue.items : snapshot.boxes.overdue.remainingItems).filter(item => item.points != null) })} /></div></>}</Box>
        <Box title={t('burnup')} icon={Activity} description={t('descriptionBurnup')} state={state('burnup')} partial={burnup?.partial} t={t}>{burnup && <><div className="mb-2 flex gap-2"><button type="button" className={`rounded-md px-2 py-1 text-xs ${burnupMode === 'items' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setBurnupMode('items')}>{t('items')}</button><button type="button" className={`rounded-md px-2 py-1 text-xs ${burnupMode === 'points' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setBurnupMode('points')}>{t('points')}</button></div><div role="img" aria-label={t('chartDescription')}><TimeArea data={burnupData(burnup, burnupMode)} reference={burnup.coverageStartedAt ?? undefined} /></div><p className="text-xs text-muted-foreground">{t('coverageNote')}</p></>}</Box>
        <Box title={t('aging')} icon={Clock3} description={t('descriptionAging')} state={state('aging')} partial={Boolean(aging?.coverageStartedAt)} t={t}>{aging && <>{aging.items.length ? <HorizontalRankingBar data={rankingData(aging.items, 'aging')} unit={t('days')} onSelect={id => setSelectedItem(aging.items.find(item => item.id === id) ?? null)} /> : <ChartEmptyState>{t('noData')}</ChartEmptyState>}<p className="text-xs text-muted-foreground">{t('topTenOldest')}</p></>}</Box>
        <Box title={t('teamLoad')} icon={Users} description={t('descriptionTeamLoad')} state={state('snapshot')} t={t}>{snapshot && <>{teamLoadHasWip ? <><div className="mb-2 flex gap-2" role="group" aria-label={t('teamLoad')}><button type="button" aria-pressed={teamLoadMode === 'items'} className={`rounded-md px-2 py-1 text-xs ${teamLoadMode === 'items' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setTeamLoadMode('items')}>{t('items')}</button><button type="button" aria-pressed={teamLoadMode === 'points'} className={`rounded-md px-2 py-1 text-xs ${teamLoadMode === 'points' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setTeamLoadMode('points')}>{t('points')}</button></div><SimpleBars data={teamLoad} /><p className="text-xs text-muted-foreground">{teamLoadMode === 'points' ? `${t('pointsCoverage')}: ${snapshot.boxes.teamLoad.pointsCoverage == null ? '—' : `${Math.round(snapshot.boxes.teamLoad.pointsCoverage)}%`}` : t('items')}</p></> : <ChartEmptyState>{t('noData')}</ChartEmptyState>}</>}</Box>
        <Box title={t('hours')} icon={BarChart3} description={t('descriptionHours')} state={state('hours')} t={t}>{hours && <><MetricValue label={t('total')} value={`${Math.round(hours.totalMinutes / 60 * 10) / 10}${t('hoursUnit')}`} />{hoursByAuthorData(hours).length ? <Donut data={hoursByAuthorData(hours).map(item => ({ ...item, unit: t('hoursUnit'), value: Math.round(Number(item.value) / 60 * 100) / 100 }))} /> : <ChartEmptyState>{t('noData')}</ChartEmptyState>}<p className="text-xs text-muted-foreground">{hours.semantics || t('manualHours')}</p></>}</Box>
      </div><div className="mt-5 flex justify-end"><button type="button" onClick={invalidateDashboard} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-muted"><RefreshCw className="h-4 w-4" />{t('refresh')}</button></div></div><ItemModal item={selectedItem} projectId={projectId} t={t} onClose={() => setSelectedItem(null)} /><OverdueModal selection={overdueModal} projectId={projectId} t={t} onClose={() => setOverdueModal(null)} /></AppShell>
}
