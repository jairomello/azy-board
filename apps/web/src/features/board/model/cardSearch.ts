// Barrel da busca de cards (T92).
//
// O runtime do board importa `cardSearchMatch` diretamente para não arrastar o
// ranking; o dropdown lazy importa `cardSearchRank`. Este barrel existe para
// conveniência dos testes e de imports que precisam do contrato completo.
export type { CardSearchItem } from './cardSearchMatch'
export { matchesCardSearch, normalizeSearchText } from './cardSearchMatch'
export type { CardSearchResponse, CardSearchResult } from './cardSearchRank'
export { getCardSearchBreadcrumb, scoreCardSearch, searchCards } from './cardSearchRank'
