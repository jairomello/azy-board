import { createEvalWorld } from '../apps/api/src/evals/seed'
import { runCase } from '../apps/api/src/evals/runner'
import { allCases, datasets } from '../apps/api/src/evals/datasets'
import { computeDatasetHash } from '../apps/api/src/evals/aggregate'
import { computeGate, latestBaseline, writeReport, evalThresholds } from '../apps/api/src/evals/report'
import { resolveProviderConfig } from '../apps/api/src/evals/provider'
import { EVAL_CONFIG } from '../apps/api/src/evals/config'
import type { EvalCaseResult, EvalReport } from '../apps/api/src/evals/types'

const args = process.argv.slice(2)

function readArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

/** Carrega credenciais locais de apps/api/.env.evals (git-ignored), sem sobrescrever o ambiente */
async function loadLocalEvalEnv(): Promise<void> {
  try {
    const { readFile } = await import('node:fs/promises')
    const raw = await readFile('apps/api/.env.evals', 'utf-8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  } catch { /* arquivo opcional local */ }
}

// Executa a suíte de evals com provider real e aplica thresholds de release.
// Sem credencial, o gate falha explicitamente para não liberar release sem verificação.
export async function buildGateReport(config: { provider: string; model: string; judgeModel: string }, results: EvalCaseResult[]): Promise<EvalReport> {
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

async function main(): Promise<number> {
  await loadLocalEvalEnv()
  const filter = args.includes('--filter') ? readArgValue('--filter') : undefined
  const cases = allCases().filter(datasetCase => filter ? datasetCase.id.includes(filter) : true)
  console.log(`[evals:gate] ${datasets.length} dataset(s), ${cases.length} caso(s)`)

  const config = resolveProviderConfig()
  if (!config) {
    console.error('[evals:gate] ERRO: credencial ausente. Configure AZY_PROVIDER_API_KEY (ou OPENAI_API_KEY/OPENROUTER_API_KEY) antes do gate de release. O gate nunca aprova silenciosamente.')
    return 2
  }

  const world = await createEvalWorld()
  console.log(`[evals:gate] provider=${config.provider} model=${config.model} judge=${config.judgeModel}`)

  const results: EvalCaseResult[] = []
  for (const datasetCase of cases) {
    process.stdout.write(`[evals:gate] executando ${datasetCase.id}... `)
    const result = await runCase(world, config, datasetCase, world.db)
    results.push(result)
    console.log(result.status)
    for (const failure of result.failures) console.log(`    - ${failure}`)
  }

  const report = await buildGateReport(config, results)
  const { jsonPath } = await writeReport(report)
  console.log(`[evals:gate] relatório: ${jsonPath}`)
  console.log('[evals:gate] scores:', JSON.stringify(report.dimensionScores))

  if (report.gate.regressions.length) console.warn('[evals:gate] regressão de qualidade:', report.gate.regressions.join('; '))
  if (report.gate.violations.length) {
    console.error('[evals:gate] FALHA no gate. Dimensões violadas:')
    for (const violation of report.gate.violations) console.error(`  - ${violation}`)
    return 1
  }
  console.log('[evals:gate] Gate de release aprovado.')
  return 0
}

const exitCode = await main().catch(error => {
  console.error('[evals:gate] erro inesperado:', error instanceof Error ? error.message : String(error))
  return 2
})
process.exit(exitCode)
