import type { DashboardAging, DashboardBurnup, DashboardHours, DashboardSnapshot } from '@azy-board/types'

export type ChartDatum = Record<string, string | number | boolean>
export const statusLabels: Record<string, string> = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', DONE: 'Done' }

export function progressData(snapshot: DashboardSnapshot) {
  const box = snapshot.boxes.progressScope
  return { total: box.total, points: box.points, donut: [{ name: 'Done', value: box.done }, { name: 'Remaining', value: Math.max(0, box.total - box.done) }], pointsDonut: [{ name: 'Done', value: box.donePoints }, { name: 'Remaining', value: Math.max(0, box.points - box.donePoints) }] }
}
export function statusData(snapshot: DashboardSnapshot, mode: 'items' | 'points' = 'items'): ChartDatum[] { return Object.entries(mode === 'items' ? snapshot.boxes.wip.byStatus : snapshot.boxes.wip.byStatusPoints).map(([status, value]) => ({ status, label: statusLabels[status] ?? status, value })) }
export function distributionData(items: DashboardSnapshot['boxes']['blocked']['items'] | DashboardSnapshot['boxes']['overdue']['items']): ChartDatum[] {
  const groups = new Map<string, number>()
  for (const item of items) { const key = item.assigneeId ? 'Assigned' : 'Unassigned'; groups.set(key, (groups.get(key) ?? 0) + 1) }
  return [...groups.entries()].map(([name, value]) => ({ name, value }))
}
export function overdueAgeData(items: DashboardSnapshot['boxes']['overdue']['items']): ChartDatum[] {
  const groups = new Map<string, number>([['0-7d', 0], ['8-30d', 0], ['31d+', 0]])
  for (const item of items) { const days = item.dueDate ? Math.max(0, Math.round((Date.now() - new Date(item.dueDate).getTime()) / 86400000)) : 0; const key = days <= 7 ? '0-7d' : days <= 30 ? '8-30d' : '31d+'; groups.set(key, (groups.get(key) ?? 0) + 1) }
  return [...groups.entries()].map(([name, value]) => ({ name, value }))
}
export function burnupData(data: DashboardBurnup, mode: 'items' | 'points'): ChartDatum[] { return data.series.map(point => ({ date: point.date, scope: mode === 'items' ? point.total : point.points, done: mode === 'items' ? point.done : point.donePoints })) }
export function agingData(data: DashboardAging): ChartDatum[] {
  const groups = new Map<string, number>([['0-1d', 0], ['2-7d', 0], ['8-30d', 0], ['31d+', 0]])
  for (const item of data.items) { const hours = item.ageHours ?? 0; const key = hours <= 24 ? '0-1d' : hours <= 168 ? '2-7d' : hours <= 720 ? '8-30d' : '31d+'; groups.set(key, (groups.get(key) ?? 0) + 1) }
  return [...groups.entries()].map(([name, value]) => ({ name, value }))
}
export function agingSummary(data: DashboardAging) { const ages = data.items.map(item => item.ageHours ?? 0).sort((a, b) => a - b); if (!ages.length) return null; return { minimum: ages[0], median: ages[Math.floor(ages.length / 2)], maximum: ages[ages.length - 1] } }
export function rankingData(items: DashboardSnapshot['boxes']['blocked']['items'] | DashboardAging['items'], mode: 'blocked' | 'aging'): ChartDatum[] { return [...items].sort((a, b) => (mode === 'blocked' ? (b.blockedAgeDays ?? 0) - (a.blockedAgeDays ?? 0) : (b.ageHours ?? 0) - (a.ageHours ?? 0))).slice(0, 10).map(item => ({ id: item.id, name: item.id.slice(0, 8), title: item.title, type: item.type ?? '—', unit: 'days', value: mode === 'blocked' ? (item.blockedAgeDays ?? 0) : ((item.ageHours ?? 0) / 24) })) }
export function comparisonData(total: number, selected: number, pointsTotal?: number, pointsSelected?: number) { return { items: [{ name: 'Selected', value: selected }, { name: 'Remaining', value: Math.max(0, total - selected) }], points: pointsTotal === undefined || pointsSelected === undefined ? null : [{ name: 'Selected', value: pointsSelected }, { name: 'Remaining', value: Math.max(0, pointsTotal - pointsSelected) }] } }
export function teamLoadData(snapshot: DashboardSnapshot, mode: 'items' | 'points' = 'items'): ChartDatum[] { const members = snapshot.boxes.teamLoad.members.map(member => ({ name: member.userName, value: mode === 'items' ? member.wipTotal : (member.wipPoints ?? 0), pointsAvailable: member.wipPoints !== null })); const unassigned = snapshot.boxes.teamLoad.unassignedWip; return unassigned ? [...members, { name: 'Unassigned', value: mode === 'items' ? unassigned : (snapshot.boxes.teamLoad.unassignedWipPoints ?? 0), pointsAvailable: snapshot.boxes.teamLoad.unassignedWipPoints !== null }] : members }
export function hoursByAuthorData(data: DashboardHours): ChartDatum[] { const groups = new Map<string, number>(); for (const row of data.rows) { const key = row.authorName ?? 'Unknown author'; groups.set(key, (groups.get(key) ?? 0) + (row.durationMin ?? 0)) } return [...groups.entries()].map(([name, minutes]) => ({ name, value: minutes, minutes })) }
