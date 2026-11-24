// Entrada lazy do campo de busca no header (T92).
//
// O componente completo (dropdown, ícones e interação) e o ranking vivem em um
// chunk próprio para não empurrar o BoardPage acima do orçamento. A interface
// deste wrapper é não-genérica para o `lazy` do React preservar a tipagem.
import { useMemo } from 'react'
import { CardSearch } from './CardSearch'
import type { CardSearchItem } from '../features/board/model/cardSearchMatch'
import { searchCards } from '../features/board/model/cardSearchRank'

export interface CardSearchHeaderProps {
  query: string
  onQueryChange: (value: string) => void
  /** População já recortada pelos filtros; o ranking é aplicado aqui. */
  items: CardSearchItem[]
  onSelect: (item: CardSearchItem) => void
  loading?: boolean
}

export default function CardSearchHeader({ query, onQueryChange, items, onSelect, loading }: CardSearchHeaderProps) {
  const response = useMemo(() => searchCards(items, query, 8), [items, query])
  return (
    <CardSearch
      query={query}
      onQueryChange={onQueryChange}
      results={response.results}
      total={response.total}
      onSelect={onSelect}
      loading={loading}
    />
  )
}
