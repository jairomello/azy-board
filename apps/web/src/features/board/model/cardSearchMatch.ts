// Predicado e normalização da busca de cards (T92).
//
// Fica separado do ranking para o chunk do BoardPage importar apenas o que o
// recorte precisa; a ordenação e o breadcrumb vivem no chunk lazy do dropdown.
import type { ItemType, TaskStatus } from '@azy-board/domain'

export interface CardSearchItem {
  id: string
  title: string
  sequenceCode?: string | null
  type?: ItemType | null
  status?: TaskStatus
  ancestryPath?: string
  assignee?: { name: string } | null
  assigneeLabel?: string | null
  updatedAt?: string
}

const DIACRITICS = /[\u0300-\u036f]/g
const CODE_QUERY = /^[estb]\d+$/

/** Normaliza para comparação: sem acentos, minúsculas e sem espaços nas pontas. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

export function compactCodeQuery(query: string): string {
  return query.replace(/^#/, '').replace(/\s+/g, '')
}

export function assigneeName(item: CardSearchItem): string {
  return item.assignee?.name ?? item.assigneeLabel ?? ''
}

function searchHaystack(item: CardSearchItem): string {
  return [item.title, item.sequenceCode ?? '', assigneeName(item)]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(' ')
}

/**
 * Predicado usado tanto pelo recorte do board quanto pelo dropdown.
 *
 * - código: exato ou prefixo (T9 encontra T9, T90…), com `#T92` e `T 92`;
 * - título e responsável: trecho, sem acento e sem caixa;
 * - múltiplos termos: todos precisam aparecer (AND), podendo estar em campos
 *   diferentes — “jairo busca” encontra um card do Jairo com “busca” no título.
 */
export function matchesCardSearch(item: CardSearchItem, query: string): boolean {
  const normalized = normalizeSearchText(query)
  if (!normalized) return true

  const code = normalizeSearchText(item.sequenceCode)
  const codeQuery = compactCodeQuery(normalized)
  if (code && CODE_QUERY.test(codeQuery) && code.startsWith(codeQuery)) return true

  const haystack = searchHaystack(item)
  const terms = normalized.split(/\s+/).filter(Boolean)
  return terms.length > 0 && terms.every(term => haystack.includes(term))
}
