import { createEvalWorld } from '../apps/api/src/evals/seed'
import { runCase } from '../apps/api/src/evals/runner'
import { allCases, datasets } from '../apps/api/src/evals/datasets'
import { computeDatasetHash } from '../apps/api/src/evals/aggregate'
import { computeGate, latestBaseline, writeReport, evalThresholds } from '../apps/api/src/evals/report'
import { resolveProviderConfig } from '../apps/api/src/evals/provider'
import { EVAL_CONFIG } from '../apps/api/src/evals/config'
import type { EvalCaseResult, EvalReport } from '../apps/api/src/evals/types'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

/** Carrega credenciais locais de apps/api/.env.evals (git-ignored), sem sobrescrever o ambiente */
export async function loadLocalEvalEnv(): Promise<void> {
  try {
    const { readFile } = await import('node:fs/promises')
    const raw = await readFile('apps/api/.env.evals', 'utf-8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  } catch { /* arquivo opcional local */ }
}

function readFlagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main(): Promise<number> {
  await loadLocalEvalEnv()
  const filter = args.includes('--filter') ? readFlagValue('--filter') : undefined
  const cases = allCases().filter(datasetCase => filter ? datasetCase.id.includes(filter) : true)

  console.log(`[evals] ${datasets.length} dataset(s), ${cases.length} caso(s) selecionado(s)`)
  if (dryRun) {
    for (const datasetCase of cases) console.log(`- ${datasetCase.id}: ${datasetCase.description}`)
    return 0
  }

  const config = resolveProviderConfig()
  if (!config) {
    console.warn('[evals] Sem credencial de provider (AZY_PROVIDER_API_KEY/OPENAI_API_KEY/OPENROUTER_API_KEY): evals pulados. Não é erro de qualidade, apenas ausência de credencial.')
    return 0
  }

  const world = await createEvalWorld()
  console.log(`[evals] provider=${config.provider} model=${config.model} judge=${config.judgeModel}`)

  const results: EvalCaseResult[] = []
  for (const datasetCase of cases) {
    process.stdout.write(`[evals] executando ${datasetCase.id}... `)
    const result = await runCase(world, config, datasetCase, world.db)
    results.push(result)
    const failed = result.failures.length
    console.log(`${result.status}${failed ? ` (${failed} falha(s))` : ''}`)
    for (const failure of result.failures) console.log(`    - ${failure}`)
  }

  const report = await buildReport(config, results)
  const { jsonPath, markdownPath } = await writeReport(report)
  console.log(`[evals] relatório: ${jsonPath}`)
  console.log('[evals] scores:', JSON.stringify(report.dimensionScores))
  if (report.gate.regressions.length) console.warn('[evals] regressão de qualidade:', report.gate.regressions.join('; '))
  return 0
}

export async function buildReport(config: { provider: string; model: string; judgeModel: string }, results: EvalCaseResult[]): Promise<EvalReport> {
  const thresholds = evalThresholds()
  const datasetHash = computeDatasetHash(allCases())
  const baseline = await latestBaseline(datasetHash)
  const gate = computeGate(results, thresholds, EVAL_CONFIG.regressionMargin.perDimension, baseline?.dimensionScores ?? null)
  return {
    generatedAt: new Date().toISOString(),
    provider: config.provider,
    model: config.model,
    judgeModel: config.judgeModel,
    datasetHash,
    dimensionScores: gate.dimensionScores,
    thresholds,
    gate,
    results,
  }
}

process.on('uncaughtException', error => {
  console.error('[evals] erro inesperado:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

if (import.meta.main) void main()
