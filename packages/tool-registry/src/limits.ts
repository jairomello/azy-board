// Limites de texto compartilhados entre o schema exposto (documentação) e o
// validador de argumentos. Mantidos alinhados com os schemas Zod da API.
export const TOOL_TEXT_LIMITS = {
  title: 500,
  name: 200,
  activity: 20_000,
  text: 2_000,
  description: 20_000,
  ref: 100,
  columnName: 128,
  tagColor: 30,
  url: 2_048,
} as const

// Card T26 — limites compartilhados do contrato de consulta de lacunas.
export const PLANNING_GAP_LIMITS = {
  maxDepth: 3,
  maxConditions: 20,
  defaultPageSize: 50,
  maxPageSize: 100,
  maxSnapshotIds: 10_000,
  snapshotTtlMs: 30 * 60 * 1_000,
} as const

export type ToolTextField = keyof typeof TOOL_TEXT_LIMITS
