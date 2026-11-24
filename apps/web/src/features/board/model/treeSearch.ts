// Filtro de busca da Árvore (T92).
//
// A grade é hierárquica: o card que casa precisa continuar acessível pelos
// ancestrais. Grupos nunca casam sozinhos; quando um TASK/BUG casa, o ramo é
// preservado inteiro para dar contexto ao resultado.
import { matchesCardSearch, normalizeSearchText } from './cardSearchMatch'

export interface TreeSearchNode {
  id: string
  title?: string
  name?: string
  type: string
  sequenceCode?: string | null
  assignee?: { name: string } | null
  assigneeLabel?: string | null
  children?: TreeSearchNode[]
}

function nodeMatchesSearch(node: TreeSearchNode, query: string): boolean {
  if (node.type !== 'TASK' && node.type !== 'BUG') return false
  return matchesCardSearch({
    id: node.id,
    title: node.title ?? node.name ?? '',
    sequenceCode: node.sequenceCode,
    assignee: node.assignee,
    assigneeLabel: node.assigneeLabel,
  }, query)
}

/**
 * Mantém os TASK/BUG que casam e todos os ancestrais necessários. Quando um
 * card casa, o ramo abaixo dele é preservado inteiro; quando só um descendente
 * casa, o pai fica com os filhos filtrados.
 */
export function filterTreeBySearch<T extends TreeSearchNode>(nodes: T[], query: string): T[] {
  if (!normalizeSearchText(query)) return nodes

  const filterNode = (node: T): T | null => {
    const originalChildren = node.children ?? []
    const children = originalChildren
      .map(child => filterNode(child as T))
      .filter((child): child is T => child !== null)

    if (nodeMatchesSearch(node, query)) {
      return { ...node, children: originalChildren }
    }
    if (children.length === 0) return null
    return { ...node, children }
  }

  return nodes
    .map(node => filterNode(node))
    .filter((node): node is T => node !== null)
}
