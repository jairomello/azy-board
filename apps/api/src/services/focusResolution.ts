// Card T19 — ordem determinística de resolução do alvo: o item em primeiro plano
// (foco) tem precedência sobre o itemId da mensagem. IDs são referências a validar.
export function focusFirstItemIds(focusItemId: string | null | undefined, messageItemId: string | null | undefined): string[] {
  return [focusItemId, messageItemId].filter((id): id is string => typeof id === 'string' && id.length > 0)
}
