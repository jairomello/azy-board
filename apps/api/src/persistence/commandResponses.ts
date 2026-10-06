/** Resposta comum de mutação em lote (fonte única para rota e journal). */
export interface BatchMutationItemResult {
  id: string
  identity: Record<string, unknown>
  changes: Record<string, unknown>
}

export interface BatchUpdateResponse {
  matchedCount: number
  updatedCount: number
  applied?: Record<string, unknown>
  items: BatchMutationItemResult[]
}

/**
 * Corpo canônico do `update_items`: matchedCount/updatedCount derivam dos itens
 * efetivamente alterados e `applied` só aparece quando as mudanças são comuns.
 * Rota e adapters usam esta função para que replay e resposta sejam idênticos.
 */
export function buildBatchUpdateResponse(items: BatchMutationItemResult[]): BatchUpdateResponse {
  const firstChanges = items[0]?.changes
  const hasCommonApplied = Boolean(firstChanges) && items.every(item => JSON.stringify(item.changes) === JSON.stringify(firstChanges))
  return {
    matchedCount: items.length,
    updatedCount: items.length,
    ...(hasCommonApplied && firstChanges ? { applied: firstChanges } : {}),
    items,
  }
}
