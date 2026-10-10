// Replanejamento automático de datas (T48) e caminho crítico (T49).
//
// O recálculo é uma AÇÃO EXPLÍCITA (nunca automático a cada edição): propaga
// início/fim pelos itens NÃO concluídos do projeto conforme os quatro tipos de
// dependência (FS/SS/SF/FF) e o retardo, no estilo MS Project.
//
// Modelo de duração:
//   - item com startDate e dueDate  → duração fixa = dueDate − startDate;
//   - item com apenas uma data      → marco (duração 0) ancorado nessa data;
//   - item sem datas                → ignora âncora própria; só muda por restrição.
// Itens DONE/CANCELLED/ARCHIVED permanecem PINADOS (servem de âncora, nunca
// são recalculados). Dependências cujo alvo está em OUTRO projeto não são
// aplicadas neste recálculo (evita vazar datas entre tenants/projetos).
import type { ItemRecord, ItemDependencyRecord } from '../persistence/models'
import type { ItemDependencyType } from '@azy-board/domain'
import type { RequestContext } from '@azy-board/api-contracts'
import { persistence } from '../persistence/runtime'
import { userMutationContext } from '../persistence/context'

const SCHEDULABLE_TYPES: ItemRecord['type'][] = ['TASK', 'BUG', 'EXTERNAL']
const PINNED_STATUSES = new Set(['DONE', 'CANCELLED', 'ARCHIVED'])

// Datas são ISO YYYY-MM-DD (UTC, sem fuso): aritmética exclusivamente em dias.
export function addCalendarDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function diffDays(start: string, end: string): number {
  return Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000)
}

interface NodeState {
  item: ItemRecord
  /** Data de início efetiva (nullable = ainda sem âncora determinada). */
  start: string | null
  due: string | null
  /** Duração fixa em dias; null = sem duração definida (marco variável). */
  duration: number | null
  changed: boolean
}

interface Constraint { predecessorId: string; type: ItemDependencyType; lag: number }

/** Calcula o início/fim efetivos de cada item não concluído do projeto. */
export function computeSchedule(
  items: ItemRecord[],
  edges: ItemDependencyRecord[],
): Map<string, { start: string | null; due: string | null; changed: boolean }> {
  const byId = new Map(items.map(item => [item.id, item]))
  const constraintsOf = new Map<string, Constraint[]>()
  for (const edge of edges) {
    // [TENANT] Só considera dependências cujo alvo está no MESMO projeto
    // (cross-project fica fora deste recálculo por política de isolamento).
    if (!byId.has(edge.dependsOnItemId)) continue
    const list = constraintsOf.get(edge.itemId) ?? []
    list.push({ predecessorId: edge.dependsOnItemId, type: edge.dependencyType, lag: edge.lagDays })
    constraintsOf.set(edge.itemId, list)
  }

  const node = (item: ItemRecord): NodeState => {
    const start = item.startDate
    const due = item.dueDate
    const duration = start && due ? diffDays(start, due) : null
    return { item, start: start ?? due ?? null, due: due ?? start ?? null, duration, changed: false }
  }

  const initial = new Map<string, NodeState>()
  for (const item of items) initial.set(item.id, node(item))

  // Ordem topológica sobre o subgrafo agendável (DAG garantido pelo T46).
  const visiting = new Set<string>()
  const order: string[] = []
  const visit = (id: string) => {
    if (order.includes(id) || visiting.has(id)) return
    visiting.add(id)
    for (const constraint of constraintsOf.get(id) ?? []) visit(constraint.predecessorId)
    visiting.delete(id)
    order.push(id)
  }
  for (const item of items) visit(item.id)

  for (const id of order) {
    const state = initial.get(id)!
    if (PINNED_STATUSES.has(state.item.status)) continue
    const constraints = constraintsOf.get(id) ?? []
    if (constraints.length === 0 && !state.start) continue
    let start = state.start
    let due = state.due
    for (const constraint of constraints) {
      const pred = initial.get(constraint.predecessorId)
      if (!pred) continue
      const predStart = pred.start ?? pred.due ?? null
      const predEnd = pred.due ?? pred.start ?? null
      if (predStart === null && predEnd === null) continue
      if (constraint.type === 'FS') {
        // Término-início: o início do sucessor segue o fim do predecessor + retardo.
        const need = addCalendarDays(predEnd!, constraint.lag)
        start = start === null ? need : maxDate(start, need)
        due = state.duration !== null ? addCalendarDays(start, state.duration) : start
      } else if (constraint.type === 'SS') {
        // Início-início: o início do sucessor segue o início do predecessor + retardo.
        const need = addCalendarDays(predStart!, constraint.lag)
        start = start === null ? need : maxDate(start, need)
        due = state.duration !== null ? addCalendarDays(start, state.duration) : start
      } else if (constraint.type === 'FF') {
        // Término-término: o fim do sucessor segue o fim do predecessor + retardo.
        const need = addCalendarDays(predEnd!, constraint.lag)
        due = due === null ? need : maxDate(due, need)
        if (state.duration !== null) {
          const derived = addCalendarDays(due, -state.duration)
          start = start === null ? derived : maxDate(start, derived)
        } else {
          start = due
        }
      } else {
        // Início-término: o fim do sucessor segue o início do predecessor + retardo.
        const need = addCalendarDays(predStart!, constraint.lag)
        due = due === null ? need : maxDate(due, need)
        if (state.duration !== null) {
          const derived = addCalendarDays(due, -state.duration)
          start = start === null ? derived : maxDate(start, derived)
        } else {
          start = due
        }
      }
    }
    state.start = start
    state.due = due
  }

  const result = new Map<string, { start: string | null; due: string | null; changed: boolean }>()
  for (const item of items) {
    const state = initial.get(item.id)!
    if (PINNED_STATUSES.has(item.status)) continue
    const changed = (state.start ?? null) !== (item.startDate ?? null) || (state.due ?? null) !== (item.dueDate ?? null)
    if (changed || state.start !== null) result.set(item.id, { start: state.start, due: state.due, changed })
  }
  return result
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b
}

/**
 * Caminho crítico (T49): cadeia de maior duração do grafo de dependências,
 * ponderada por `duração + lag`. Usa passagem para frente e para trás no DAG:
 * um item participa do caminho crítico quando a soma da maior cadeia que chega
 * nele com a maior cadeia que parte dele iguala a duração total do cronograma.
 * Itens sem datas entram com duração 0. SS/SF/FF são aproximados pelo retardo.
 */
export function computeCriticalPath(items: ItemRecord[], edges: ItemDependencyRecord[]): Set<string> {
  if (edges.length === 0) return new Set()
  const byId = new Map(items.map(item => [item.id, item]))
  const predecessorsOf = new Map<string, Array<{ id: string; lag: number }>>()
  const dependentsOf = new Map<string, Array<{ id: string; lag: number }>>()
  for (const edge of edges) {
    if (!byId.has(edge.dependsOnItemId) || !byId.has(edge.itemId)) continue
    const preds = predecessorsOf.get(edge.itemId) ?? []
    preds.push({ id: edge.dependsOnItemId, lag: edge.lagDays })
    predecessorsOf.set(edge.itemId, preds)
    const deps = dependentsOf.get(edge.dependsOnItemId) ?? []
    deps.push({ id: edge.itemId, lag: edge.lagDays })
    dependentsOf.set(edge.dependsOnItemId, deps)
  }
  const duration = (id: string) => {
    const item = byId.get(id)!
    return item.startDate && item.dueDate ? Math.max(0, diffDays(item.startDate, item.dueDate)) : 0
  }
  const fwdMemo = new Map<string, number>()
  const forward = (id: string): number => {
    if (fwdMemo.has(id)) return fwdMemo.get(id)!
    let best = duration(id)
    for (const pred of predecessorsOf.get(id) ?? []) best = Math.max(best, forward(pred.id) + pred.lag + duration(id))
    fwdMemo.set(id, best)
    return best
  }
  const bwdMemo = new Map<string, number>()
  const backward = (id: string): number => {
    if (bwdMemo.has(id)) return bwdMemo.get(id)!
    let best = duration(id)
    for (const dep of dependentsOf.get(id) ?? []) best = Math.max(best, backward(dep.id) + dep.lag + duration(id))
    bwdMemo.set(id, best)
    return best
  }
  let total = 0
  for (const item of items) total = Math.max(total, backward(item.id))
  const critical = new Set<string>()
  for (const item of items) {
    const id = item.id
    if (forward(id) + (backward(id) - duration(id)) === total && total > 0) critical.add(id)
  }
  return critical
}

export interface ScheduleRecalculateResult { updatedCount: number; checkedCount: number; ignoredCrossProject: number }

/** Executa o recálculo e persiste apenas os itens cujas datas mudaram. */
export async function recalculateProjectSchedule(
  identity: RequestContext,
  projectId: string,
): Promise<ScheduleRecalculateResult> {
  const context = userMutationContext(identity, 'REST')
  const items = await persistence.items.listItems(context, projectId)
  const recyclable = items.filter(item => SCHEDULABLE_TYPES.includes(item.type))
  const edges = await persistence.itemDependencies.listByProject(context, projectId)
  const computed = computeSchedule(recyclable, edges)
  let updatedCount = 0
  for (const [itemId, next] of computed) {
    if (!next.changed || next.start === null) continue
    const patch: { startDate: string | null; dueDate: string | null } = { startDate: next.start, dueDate: next.due }
    await persistence.unitOfWork.updateItemWithRelations(context, projectId, itemId, patch)
    updatedCount += 1
  }
  const checkedCount = recyclable.filter(item => item.status !== 'DONE' && item.status !== 'CANCELLED' && item.status !== 'ARCHIVED').length
  return { updatedCount, checkedCount, ignoredCrossProject: edges.filter(edge => !recyclable.some(item => item.id === edge.dependsOnItemId)).length }
}