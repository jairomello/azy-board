import { coreDataset } from './core'
import type { EvalCase } from '../types'

export type EvalDataset = { id: string; description: string; cases: EvalCase[] }

export const datasets: EvalDataset[] = [
  { id: 'core', description: 'Casos centrais do Azy Agent: leitura, criação, hierarquia, updates em lote, recusas e segurança', cases: coreDataset },
]

export function allCases(): EvalCase[] {
  return datasets.flatMap(dataset => dataset.cases)
}
