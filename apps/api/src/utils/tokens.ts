// T77 — total de tokens derivado do consumo de IA registrado no card.
// O total nunca é persistido: é sempre a soma de tokensInput e tokensOutput,
// e permanece nulo quando nenhum dos dois lados foi informado.
export function tokensTotal(tokensInput: number | null | undefined, tokensOutput: number | null | undefined): number | null {
  if (tokensInput == null && tokensOutput == null) return null
  return (tokensInput ?? 0) + (tokensOutput ?? 0)
}

export function withTokensTotal<T extends { tokensInput: number | null; tokensOutput: number | null }>(item: T): T & { tokensTotal: number | null } {
  return { ...item, tokensTotal: tokensTotal(item.tokensInput, item.tokensOutput) }
}
