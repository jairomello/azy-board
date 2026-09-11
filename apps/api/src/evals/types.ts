export type EvalDimension =
  | 'taskCompletion'
  | 'toolCorrectness'
  | 'faithfulness'
  | 'scope'
  | 'safety'
  | 'noLeak'
  | 'refusalCorrectness'
  | 'promptAlignment'

export const EVAL_DIMENSIONS: Record<EvalDimension, { label: string }> = {
  taskCompletion: { label: 'Task Completion' },
  toolCorrectness: { label: 'Tool Correctness' },
  faithfulness: { label: 'Faithfulness' },
  scope: { label: 'Escopo / Relevância' },
  safety: { label: 'Segurança (toxicidade/bias)' },
  noLeak: { label: 'No-leak de secrets/stack' },
  refusalCorrectness: { label: 'Recusa correta' },
  promptAlignment: { label: 'Alinhamento ao system prompt' },
}

export type ItemType = 'EPIC' | 'STORY' | 'TASK' | 'BUG'

export type EvalSeedItem = {
  ref: string
  title: string
  type: ItemType
  parentRef?: string
  status?: string
  column?: string
  points?: number
  assign?: boolean
}

export type EvalSetup = { items?: EvalSeedItem[] }

export type ExpectedTool = { name: string; argsContains?: Record<string, unknown> }

export type ToolApi = (path: string, method?: string, body?: unknown) => Promise<unknown>

export type CountItemsFilter = { type?: ItemType; status?: string; titleContains?: string }

export type CountItems = (projectId: string, filter?: CountItemsFilter) => Promise<number>

export type EvalCaseContext = {
  projectId: string
  userId: string
  tenantId: string
  itemRefs: Map<string, string>
}

export type EvalExpectations = {
  /** Tools que devem ser chamadas na run, com argumentos-chave opcionais */
  expectedTools?: ExpectedTool[]
  /** Ao menos uma destas deve ser chamada (alternativas válidas de contrato) */
  expectedAny?: ExpectedTool[]
  /** Tools que NÃO podem ser chamadas */
  forbiddenTools?: string[]
  /** Nenhuma tool pode ser chamada (pedido >40 ações, recusa, fora de escopo) */
  mustNotCallTools?: boolean
  /** Run deve terminar em WAITING_USER (pergunta) */
  askQuestion?: boolean
  /** Verificação do estado do DB pós-run; retorna string de falha ou null */
  assertState?: (db: unknown, context: EvalCaseContext, helpers: { countItems: CountItems; worldApi: ToolApi }) => Promise<string | null>
}

export type EvalCase = {
  id: string
  description: string
  userMessage: string
  setup?: EvalSetup
  expectations?: EvalExpectations
  /** Critérios qualitativos avaliados por LLM-as-judge (escala 0–1) */
  qualitativeLints?: Array<{ dimension: EvalDimension; criterion: string }>
  /** Repetir execução em flakiness residual (transformando determinístico-falha em média) */
  retry?: number
  tags?: string[]
}

export type EvalToolCallRecord = { name: string; args: Record<string, unknown>; ok: boolean }

export type EvalCaseResult = {
  caseId: string
  status: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'ERROR'
  runStatus?: string
  finalText?: string
  toolCalls: EvalToolCallRecord[]
  scores: Partial<Record<EvalDimension, number>>
  failures: string[]
  judgeJustifications: string[]
  durationMs: number
}

export type EvalReport = {
  generatedAt: string
  provider: string
  model: string
  judgeModel: string
  datasetHash: string
  dimensionScores: Partial<Record<EvalDimension, number>>
  thresholds: Partial<Record<EvalDimension, number>>
  gate: { pass: boolean; violations: string[]; regressions: string[] }
  results: EvalCaseResult[]
}
