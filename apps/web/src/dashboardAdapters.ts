import type { DashboardAging, DashboardBurnup, DashboardHours, DashboardSnapshot, DashboardTokenBucket, DashboardTokens } from '@azy-board/ui-contracts'
import { displayPersonName } from './lib/personName'

// Adaptadores dos gráficos do dashboard. Todo rótulo exibido vem dos recursos de
// tradução: as funções recebem o `t` do namespace `dashboard` e devolvem dados prontos
// para o gráfico, sem literais de produto (ver check:i18n).
export type ChartDatum = Record<string, string | number | boolean>
/** Tradutor do namespace `dashboard`. */
export type DashboardTranslator = (key: string) => string

// Chaves literais: o gate de i18n valida chaves de tradução e não aceita chave dinâmica.
export function statusLabel(status: string, t: DashboardTranslator): string {
  if (status === 'DONE') return t('done')
  if (status === 'IN_PROGRESS') return t('inProgress')
  if (status === 'BLOCKED') return t('blockedStatus')
  if (status === 'NOT_STARTED') return t('notStarted')
  return status
}

export function progressData(snapshot: DashboardSnapshot, t: DashboardTranslator) {
  const box = snapshot.boxes.progressScope
  return {
    total: box.total,
    points: box.points,
    advance: box.advance,
    donut: [{ name: t('done'), value: box.done }, { name: t('remaining'), value: Math.max(0, box.total - box.done) }],
    pointsDonut: [{ name: t('done'), value: box.donePoints }, { name: t('remaining'), value: Math.max(0, box.points - box.donePoints) }],
  }
}

export function statusData(snapshot: DashboardSnapshot, mode: 'items' | 'points', t: DashboardTranslator): ChartDatum[] {
  return Object.entries(mode === 'items' ? snapshot.boxes.wip.byStatus : snapshot.boxes.wip.byStatusPoints)
    .map(([status, value]) => ({ status, label: statusLabel(status, t), value }))
}

export function burnupData(data: DashboardBurnup, mode: 'items' | 'points'): ChartDatum[] {
  return data.series.map(point => ({ date: point.date, scope: mode === 'items' ? point.total : point.points, done: mode === 'items' ? point.done : point.donePoints }))
}

/**
 * Houve evolução no período? Conclusão em algum dia ou variação de escopo.
 *
 * Um burnup sem conclusão e com escopo constante é uma faixa reta: o quadro explica isso
 * em vez de desenhar um gráfico que parece vazio.
 */
export function burnupHasEvolution(data: DashboardBurnup, mode: 'items' | 'points'): boolean {
  const pontos = data.series.map(ponto => mode === 'items'
    ? { scope: ponto.total, done: ponto.done }
    : { scope: ponto.points, done: ponto.donePoints })
  if (pontos.some(ponto => ponto.done > 0)) return true
  return new Set(pontos.map(ponto => ponto.scope)).size > 1
}

export function agingSummary(data: DashboardAging) {
  const ages = data.items.map(item => item.ageHours ?? 0).sort((a, b) => a - b)
  if (!ages.length) return null
  return { minimum: ages[0], median: ages[Math.floor(ages.length / 2)], maximum: ages[ages.length - 1] }
}

export function rankingData(items: DashboardSnapshot['boxes']['blocked']['items'] | DashboardAging['items'], mode: 'blocked' | 'aging'): ChartDatum[] {
  return [...items]
    .sort((a, b) => (mode === 'blocked' ? (b.blockedAgeDays ?? 0) - (a.blockedAgeDays ?? 0) : (b.ageHours ?? 0) - (a.ageHours ?? 0)))
    .slice(0, 10)
    .map(item => ({
      id: item.id,
      // Rótulo legível no eixo: código sequencial ou título (nunca o identificador técnico).
      name: item.sequenceCode ?? item.title,
      title: item.title,
      sequenceCode: item.sequenceCode ?? '',
      // Sinaliza idade mínima conhecida (episódio iniciado antes da cobertura observada).
      minimumKnown: item.minimumKnown === true,
      type: item.type ?? '',
      unit: 'days',
      value: mode === 'blocked' ? (item.blockedAgeDays ?? 0) : ((item.ageHours ?? 0) / 24),
    }))
}

export function teamLoadData(snapshot: DashboardSnapshot, mode: 'items' | 'points', t: DashboardTranslator): ChartDatum[] {
  const members = snapshot.boxes.teamLoad.members.map(member => ({
    name: displayPersonName(member.userName),
    title: member.userName,
    value: mode === 'items' ? Math.max(0, member.wipTotal - (member.blockedSubset ?? 0)) : Math.max(0, (member.wipPoints ?? 0) - (member.blockedPoints ?? 0)),
    pointsAvailable: member.wipPoints !== null,
  }))
  const unassigned = Math.max(0, snapshot.boxes.teamLoad.unassignedWip - (snapshot.boxes.teamLoad.blockedUnassignedSubset ?? 0))
  if (!unassigned) return members
  const unassignedLabel = t('unassigned')
  return [...members, {
    name: unassignedLabel,
    title: unassignedLabel,
    value: mode === 'items' ? unassigned : Math.max(0, (snapshot.boxes.teamLoad.unassignedWipPoints ?? 0) - (snapshot.boxes.teamLoad.unassignedBlockedPoints ?? 0)),
    pointsAvailable: snapshot.boxes.teamLoad.unassignedWipPoints !== null,
  }]
}

export function hoursByAuthorData(data: DashboardHours, t: DashboardTranslator): ChartDatum[] {
  const fallback = t('unknownAuthor')
  if (data.byAuthor) return data.byAuthor.map(row => ({ name: row.authorName ?? fallback, value: row.totalMinutes, minutes: row.totalMinutes }))
  const groups = new Map<string, number>()
  for (const row of data.rows) {
    const key = row.authorName ?? fallback
    groups.set(key, (groups.get(key) ?? 0) + (row.durationMin ?? 0))
  }
  return [...groups.entries()].map(([name, minutes]) => ({ name, value: minutes, minutes }))
}

// T80 — tokens de IA: recortes e série diária do quadro de tokens.
export function tokenSeriesData(data: DashboardTokens): ChartDatum[] {
  return data.series.map(point => ({ date: point.date, registered: point.tokens, done: point.doneTokens }))
}

/** Houve algum token registrado na série exibida? */
export function tokensHaveSeries(data: DashboardTokens): boolean {
  return data.series.some(point => point.tokens > 0)
}

export function tokenStatusData(data: DashboardTokens, t: DashboardTranslator): ChartDatum[] {
  return data.boxes.byStatus.map(bucket => ({ status: bucket.key ?? '', label: statusLabel(bucket.key ?? '', t), value: bucket.tokens }))
}

/** Ranking dos recortes com mais tokens; rótulo resolvido pelo catálogo (nunca o identificador). */
export function tokenRecorteData(buckets: DashboardTokenBucket[], label: (key: string | null) => string): ChartDatum[] {
  return [...buckets]
    .filter(bucket => bucket.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10)
    .map(bucket => ({ name: label(bucket.key), value: bucket.tokens, count: bucket.count }))
}
