import { averageAdvance, computeAdvance, orderColumns, resolveColumnProgressWeights, type CardChecklistProgress, type ProgressColumn } from '@azy-board/domain'

export interface TreeProgressNode {
  id?: string
  type: string
  status?: string | null
  columnId?: string | null
  children?: TreeProgressNode[]
  isLeaf?: boolean
  points?: number | null
  progress?: number
}

export interface TreeProgressContext {
  /** Colunas do projeto com o peso explícito em `progressWeight` (a derivação acontece aqui). */
  columns: readonly ProgressColumn[]
  /** Progresso de checklist por item, quando disponível. */
  progressByItem?: ReadonlyMap<string, CardChecklistProgress>
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Enriches a visible tree bottom-up using only TASK/BUG leaves.
 *
 * O progresso de cada folha é o **avanço** da sua coluna, refinado pelo checklist
 * (`packages/domain/src/progress.ts`); agrupadores exibem a média do avanço das folhas.
 * Item sem coluna conhecida cai na regra de conclusão (`DONE` = 100%, resto = 0%).
 */
export function addTreeProgress<T extends TreeProgressNode>(
  nodes: T[],
  context: TreeProgressContext = { columns: [] },
): Array<T & { progress: number }> {
  const ordered = orderColumns(context.columns)
  const weights = resolveColumnProgressWeights(ordered)

  function leafAdvance(node: TreeProgressNode): number {
    const index = ordered.findIndex(column => column.id === node.columnId)
    if (index < 0) return node.status === 'DONE' ? 100 : 0
    const columnWeight = weights.get(ordered[index]!.id) ?? 0
    const previous = index === 0 ? 0 : weights.get(ordered[index - 1]!.id) ?? 0
    const checklist = node.id ? context.progressByItem?.get(node.id) ?? null : null
    return computeAdvance({ columnWeight, previousColumnWeight: previous, checklist })
  }

  function enrich(node: T): T & { progress: number } {
    const children = (node.children ?? []).map(child => enrich(child as T))
    const leaves = children.flatMap(child =>
      child.type === 'TASK' || child.type === 'BUG'
        ? child.children && child.children.length > 0 ? collectLeaves(child) : [child]
        : collectLeaves(child)
    )
    const isLeaf = node.isLeaf ?? children.length === 0
    const progress = isLeaf && (node.type === 'TASK' || node.type === 'BUG')
      ? leafAdvance(node)
      : leaves.length === 0
        ? 0
        : clampProgress(averageAdvance(leaves.map(leaf => leaf.progress ?? 0)))
    const points = isLeaf && (node.type === 'TASK' || node.type === 'BUG')
      ? node.points ?? 0
      : leaves.reduce((sum, leaf) => sum + (leaf.points ?? 0), 0)

    return { ...node, progress, points, children } as T & { progress: number }
  }

  return nodes.map(enrich)
}

function collectLeaves(node: TreeProgressNode): TreeProgressNode[] {
  const children = node.children ?? []
  if (children.length === 0) {
    if (node.isLeaf === false) return []
    return node.type === 'TASK' || node.type === 'BUG' ? [node] : []
  }
  return children.flatMap(collectLeaves)
}
