import { averageAdvance, createAdvanceResolver, isProgressLeafType, type ProgressColumn } from '@azy-board/domain'

export interface TreeProgressNode {
  id?: string
  type: string
  status?: string | null
  columnId?: string | null
  children?: TreeProgressNode[]
  isLeaf?: boolean
  points?: number | null
  progress?: number | null
}

export interface TreeProgressContext {
  /** Colunas do projeto com o peso explícito em `progressWeight` (a derivação acontece aqui). */
  columns: readonly ProgressColumn[]
  /** Itens que são sempre contêiner, mesmo vazios (ex.: a STORY fixa do modo SIMPLE). */
  containerIds?: ReadonlySet<string>
}

interface LeafValue {
  progress: number | null
  points: number
}

/**
 * Enriquece a árvore visível de baixo para cima (B19).
 *
 * - Folha de progresso = item sem filhos do tipo TASK, BUG, STORY ou EPIC. `EXTERNAL` é
 *   dependência externa e fica fora, como no dashboard.
 * - O avanço da folha vem do **status**, refinado apenas pela coluna
 *   (`createAdvanceResolver` em `packages/domain/src/progress.ts`); o checklist tem
 *   indicador próprio no card e não influencia este percentual.
 * - Folha cancelada ou arquivada recebe `progress: null` e não entra na conta do pai.
 * - O agrupador exibe a média de todas as folhas válidas abaixo dele (média das filhas
 *   ponderada pelo número de itens). Sem nenhuma folha, 0%; só com canceladas, `null`.
 * - Pontos do agrupador somam só as folhas válidas (cancelado fica fora, como no dashboard).
 */
export function addTreeProgress<T extends TreeProgressNode>(
  nodes: T[],
  context: TreeProgressContext = { columns: [] },
): Array<T & { progress: number | null }> {
  const resolve = createAdvanceResolver(context.columns)

  function isProgressLeaf(node: TreeProgressNode): boolean {
    if (node.id && context.containerIds?.has(node.id)) return false
    return (node.children?.length ?? 0) === 0 && isProgressLeafType(node.type)
  }

  function leafProgress(node: TreeProgressNode): number | null {
    return resolve({ status: node.status ?? null, columnId: node.columnId ?? null })
  }

  function enrich(node: T): { node: T & { progress: number | null }; leaves: LeafValue[] } {
    if (isProgressLeaf(node)) {
      const progress = leafProgress(node)
      return {
        node: { ...node, progress, points: node.points ?? 0, children: node.children ?? [] } as T & { progress: number | null },
        leaves: [{ progress, points: progress === null ? 0 : node.points ?? 0 }],
      }
    }
    if (node.type === 'EXTERNAL' && (node.children?.length ?? 0) === 0) {
      // Dependência externa não tem avanço próprio na árvore: exibe "—" e não pesa no pai.
      return { node: { ...node, progress: null, children: [] } as T & { progress: number | null }, leaves: [] }
    }
    const enriched = (node.children ?? []).map(child => enrich(child as T))
    const leaves = enriched.flatMap(result => result.leaves)
    const valid = leaves.flatMap(leaf => leaf.progress === null ? [] : [leaf.progress])
    const progress = leaves.length === 0
      ? 0
      : valid.length === 0 ? null : averageAdvance(valid)
    const points = leaves.reduce((sum, leaf) => sum + leaf.points, 0)
    return {
      node: { ...node, progress, points, children: enriched.map(result => result.node) } as T & { progress: number | null },
      leaves,
    }
  }

  return nodes.map(node => enrich(node).node)
}
