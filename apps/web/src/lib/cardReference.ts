export interface CardReferenceInput {
  id: string
  title: string
  sequenceCode?: string | null
}

// Referência em texto plano para colar em prompts de CLI/agentes:
// com código:    'T5 - Título do card [id=<uuid completo>]'
// sem código:    'Título do card [id=<uuid completo>]'
// Quando o item não tem sequenceCode, nenhum código é incluído (nem o id curto).
export function formatCardReference(card: CardReferenceInput): string {
  const code = card.sequenceCode?.trim()
  const prefix = code ? `${code} - ` : ''
  return `'${prefix}${card.title} [id=${card.id}]'`
}
