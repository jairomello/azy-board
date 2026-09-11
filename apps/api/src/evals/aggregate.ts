import { createHash } from 'node:crypto'
import type { CountItems, EvalCaseContext, EvalDimension, ToolApi } from './types'

export type HashableCase = { id: string; userMessage: string; setup?: unknown; expectations?: unknown; qualitativeLints?: unknown }

export function computeDatasetHash(cases: readonly HashableCase[]): string {
  const payload = cases.map(theCase => ({ id: theCase.id, userMessage: theCase.userMessage, setup: theCase.setup, expectations: theCase.expectations, qualitativeLints: theCase.qualitativeLints }))
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16)
}

/** Média das pontuações da dimensão entre casos onde ela foi medida; null quando nenhum caso a avaliou */
export function scoreDimensionAverage(results: ReadonlyArray<{ scores: Partial<Record<EvalDimension, number>>; status: string }>, dimension: EvalDimension): number | null {
  const values = results.filter(result => result.status !== 'ERROR' && result.status !== 'INDETERMINATE').map(result => result.scores[dimension]).filter((value): value is number => typeof value === 'number')
  if (!values.length) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** Executa assertState declarativo do caso para computar taskCompletion determinístico */
export async function runAssertState(
  worldDb: unknown,
  context: EvalCaseContext,
  worldApi: ToolApi,
  countItems: CountItems,
  assertState: (db: unknown, context: EvalCaseContext, helpers: { countItems: CountItems; worldApi: ToolApi }) => Promise<string | null>,
  scores: Partial<Record<EvalDimension, number>>,
  failures: string[],
): Promise<void> {
  try {
    const failure = await assertState(worldDb, context, { countItems, worldApi })
    scores.taskCompletion = failure ? 0 : 1
    if (failure) failures.push(`[taskCompletion] ${failure}`)
  } catch (error) {
    scores.taskCompletion = 0
    failures.push(`[taskCompletion] assertState falhou: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`)
  }
}
