// Ranking e apresentação dos resultados da busca (T92).
//
// Este módulo é carregado sob demanda junto do dropdown, não no chunk principal
// do board. Ele depende do predicado em `cardSearchMatch`.
import type { AncestorNode } from '@azy-board/ui-contracts'
import {
  assigneeName,
  compactCodeQuery,
  matchesCardSearch,
  normalizeSearchText,
  type CardSearchItem,
} from './cardSearchMatch'

export interface CardSearchResult<T extends CardSearchItem = CardSearchItem> {
  item: T
  score: number
}

export interface CardSearchResponse<T extends CardSearchItem = CardSearchItem> {
  results: CardSearchResult<T>[]
  total: number
}

function wordStartsWith(text: string, query: string): boolean {
  if (!query || query.includes(' ')) return false
  return text.split(/\s+/).some(word => word.startsWith(query))
}

/** Pontuação de relevância: código exato > título exato > prefixos > trechos. */
export function scoreCardSearch(item: CardSearchItem, query: string): number {
  const normalized = normalizeSearchText(query)
  if (!normalized || !matchesCardSearch(item, query)) return 0

  const title = normalizeSearchText(item.title)
  const code = normalizeSearchText(item.sequenceCode)
  const assignee = normalizeSearchText(assigneeName(item))
  const codeQuery = compactCodeQuery(normalized)
  let score = 0

  if (code && (code === codeQuery || code === normalized)) score = Math.max(score, 1000)
  else if (code && codeQuery && code.startsWith(codeQuery)) score = Math.max(score, 900)
  else if (code && code.includes(normalized)) score = Math.max(score, 400)

  if (title === normalized) score = Math.max(score, 950)
  else if (wordStartsWith(title, normalized)) score = Math.max(score, 850)
  else if (title.startsWith(normalized)) score = Math.max(score, 820)
  else if (title.includes(normalized)) score = Math.max(score, 750)

  if (assignee === normalized) score = Math.max(score, 600)
  else if (assignee.includes(normalized)) score = Math.max(score, 500)

  // Múltiplos termos distribuídos entre campos: casa, mas perde para um trecho
  // contínuo no título/código.
  return score > 0 ? score : 300
}

function compareUpdatedAt(left: CardSearchItem, right: CardSearchItem): number {
  return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
}

/**
 * Filtra, ordena e limita os resultados. `total` é a quantidade de cards que
 * casam antes do limite, para o rodapé do dropdown (“8 de 23 resultados”).
 */
export function searchCards<T extends CardSearchItem>(
  items: T[],
  query: string,
  limit = 8,
): CardSearchResponse<T> {
  const normalized = normalizeSearchText(query)
  if (!normalized) return { results: [], total: 0 }

  const matches = items
    .map(item => ({ item, score: scoreCardSearch(item, query) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => (
      right.score - left.score ||
      compareUpdatedAt(left.item, right.item) ||
      left.item.title.localeCompare(right.item.title, 'pt-BR')
    ))

  return {
    results: matches.slice(0, Math.max(0, limit)),
    total: matches.length,
  }
}

/** Breadcrumb legível a partir do `ancestryPath` JSON (Épico › História). */
export function getCardSearchBreadcrumb(item: Pick<CardSearchItem, 'ancestryPath'>): string {
  try {
    const path = JSON.parse(item.ancestryPath || '[]') as AncestorNode[]
    return path.map(node => node.title).filter(Boolean).join(' › ')
  } catch {
    return ''
  }
}
