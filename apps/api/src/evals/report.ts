import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EVAL_CONFIG } from './config'
import { computeDatasetHash, scoreDimensionAverage } from './aggregate'
import type { EvalCaseResult, EvalDimension, EvalReport } from './types'

export type GateComputation = { pass: boolean; violations: string[]; regressions: string[]; dimensionScores: Partial<Record<EvalDimension, number | null>> }

export function computeGate(results: readonly EvalCaseResult[], thresholds: ReturnType<typeof evalThresholds>, margin: number, baseline: Partial<Record<EvalDimension, number>> | null): GateComputation {
  const dimensionScores: Partial<Record<EvalDimension, number | null>> = {}
  const violations: string[] = []
  const regressions: string[] = []
  for (const [dimension, threshold] of Object.entries(thresholds) as Array<[EvalDimension, number]>) {
    const score = scoreDimensionAverage(results, dimension)
    dimensionScores[dimension] = score
    if (score === null) continue
    if (score < threshold) violations.push(`${dimension}: ${score.toFixed(3)} < threshold ${threshold}`)
    const previous = baseline?.[dimension]
    if (typeof previous === 'number' && score < previous - margin) regressions.push(`${dimension}: ${score.toFixed(3)} caiu ${(previous - score).toFixed(3)} em relação ao baseline (${previous.toFixed(3)}), acima da margem ${margin}`)
  }
  return { pass: violations.length === 0, violations, regressions, dimensionScores }
}

export function evalThresholds(): Partial<Record<EvalDimension, number>> {
  return { ...EVAL_CONFIG.thresholds }
}

export async function writeReport(report: EvalReport): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(EVAL_CONFIG.reportsDir, { recursive: true })
  const stamp = report.generatedAt.replace(/[:.]/g, '-')
  const jsonPath = join(EVAL_CONFIG.reportsDir, `eval-${stamp}.json`)
  const markdownPath = join(EVAL_CONFIG.reportsDir, `eval-${stamp}.md`)
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8')
  await writeFile(markdownPath, markdownReport(report), 'utf-8')
  return { jsonPath, markdownPath }
}

export async function latestBaseline(datasetHash: string): Promise<EvalReport | null> {
  try {
    const files = (await import('node:fs/promises')).readdir
    const { readdir } = await import('node:fs/promises')
    const names = (await readdir(EVAL_CONFIG.reportsDir)).filter(name => name.endsWith('.json')).sort()
    for (const name of names.reverse()) {
      const raw = await readFile(join(EVAL_CONFIG.reportsDir, name), 'utf-8')
      const parsed = JSON.parse(raw) as EvalReport
      if (parsed.datasetHash === datasetHash && parsed.gate && Array.isArray(parsed.results)) return parsed
    }
    return null
  } catch {
    return null
  }
}

function markdownReport(report: EvalReport): string {
  const lines: string[] = []
  lines.push(`# Eval Report — ${report.generatedAt}`)
  lines.push(`- provider: ${report.provider} / model: ${report.model} / judge: ${report.judgeModel}`)
  lines.push(`- datasetHash: ${report.datasetHash}`)
  lines.push(`- gate: ${report.gate.pass ? 'PASS' : 'FAIL'}`)
  lines.push('')
  lines.push('## Dimensões')
  for (const [dimension, score] of Object.entries(report.dimensionScores) as Array<[EvalDimension, number | null]>) {
    const threshold = report.thresholds[dimension]
    lines.push(`- **${dimension}**: ${score === null ? 'n/a' : score.toFixed(3)} (threshold ${typeof threshold === 'number' ? threshold : 'n/a'})`)
  }
  if (report.gate.violations.length) lines.push(`- violações: ${report.gate.violations.join('; ')}`)
  if (report.gate.regressions.length) lines.push(`- regressões: ${report.gate.regressions.join('; ')}`)
  lines.push('')
  lines.push('## Casos')
  for (const result of report.results) {
    lines.push(`### ${result.caseId} — ${result.status}`)
    lines.push(`- runStatus: ${result.runStatus ?? 'n/a'} / duração: ${result.durationMs}ms`)
    if (result.finalText) lines.push(`- resposta final: ${result.finalText.slice(0, 300).replace(/\n/g, ' ')}`)
    for (const failure of result.failures) lines.push(`- FALHA: ${failure}`)
    for (const judge of result.judgeJustifications) lines.push(`- judge: ${judge}`)
    lines.push('')
  }
  return lines.join('\n')
}
