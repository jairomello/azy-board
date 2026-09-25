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
} as const

export type ToolTextField = keyof typeof TOOL_TEXT_LIMITS
