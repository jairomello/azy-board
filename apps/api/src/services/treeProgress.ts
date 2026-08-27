export interface TreeProgressNode {
  type: string
  status?: string | null
  children?: TreeProgressNode[]
  isLeaf?: boolean
  points?: number | null
  progress?: number
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Enriches a visible tree bottom-up using only TASK/BUG leaves. */
export function addTreeProgress<T extends TreeProgressNode>(nodes: T[]): Array<T & { progress: number }> {
  function enrich(node: T): T & { progress: number } {
    const children = (node.children ?? []).map(child => enrich(child as T))
    const leaves = children.flatMap(child =>
      child.type === 'TASK' || child.type === 'BUG'
        ? child.children && child.children.length > 0 ? collectLeaves(child) : [child]
        : collectLeaves(child)
    )
    const isLeaf = node.isLeaf ?? children.length === 0
    const progress = isLeaf && (node.type === 'TASK' || node.type === 'BUG')
      ? node.status === 'DONE' ? 100 : 0
      : leaves.length === 0
        ? 0
        : clampProgress((leaves.filter(leaf => leaf.status === 'DONE').length / leaves.length) * 100)
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
