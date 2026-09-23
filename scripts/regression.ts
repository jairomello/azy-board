/**
 * Bateria de regressão do Azy Board.
 *
 * Roda, em sequência, todas as verificações estáticas e de contrato do projeto e
 * apresenta um resumo por etapa. Etapas que dependem de servidores só rodam com
 * flag explícita.
 *
 * Uso:
 *   bun run test:regression                 # estáticas + contratos
 *   bun run test:regression --with-e2e      # inclui o E2E de navegador (sobe o stack)
 *   bun run test:regression --with-smoke    # inclui o smoke contra um stack já de pé
 *   bun run test:regression --all           # inclui e2e e smoke
 */

import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const args = process.argv.slice(2)
const withE2e = args.includes('--with-e2e') || args.includes('--all')
const withSmoke = args.includes('--with-smoke') || args.includes('--all')

interface Stage {
  name: string
  cmd: string[]
}

const stages: Stage[] = [
  { name: 'typecheck (4 workspaces)', cmd: ['bun', 'run', 'typecheck'] },
  { name: 'lint (Biome)', cmd: ['bun', 'run', 'lint'] },
  { name: 'testes (bun test)', cmd: ['bun', 'test'] },
  { name: 'build (api + web + mcp)', cmd: ['bun', 'run', 'build'] },
  { name: 'migrations e integridade do schema', cmd: ['bun', 'run', 'test:migrations'] },
  { name: 'contrato do catálogo MCP', cmd: ['bun', 'run', 'test:mcp-catalog'] },
  { name: 'paridade i18n (pt-BR, en, es)', cmd: ['bun', 'run', 'check:i18n'] },
  { name: 'skill oficial do agente', cmd: ['bun', 'run', 'test:agent-skill'] },
  { name: 'orçamento de bundle', cmd: ['bun', 'run', 'check:bundle'] },
]

if (withE2e) stages.push({ name: 'E2E de navegador (Playwright)', cmd: ['bun', 'run', 'test:e2e'] })
if (withSmoke) stages.push({ name: 'smoke (stack de pé)', cmd: ['bun', 'run', 'test:smoke'] })

interface Result {
  name: string
  ok: boolean
  durationMs: number
  output?: string
}

async function runStage(stage: Stage): Promise<Result> {
  const started = Date.now()
  const proc = Bun.spawn({ cmd: stage.cmd, cwd: root, env: process.env, stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const output = `${stdout}\n${stderr}`.trim()
  return { name: stage.name, ok: exitCode === 0, durationMs: Date.now() - started, output: exitCode === 0 ? undefined : output }
}

const results: Result[] = []
console.log(`▶ Bateria de regressão (${stages.length} etapas${withE2e || withSmoke ? ', com servidores' : ''})\n`)

for (const stage of stages) {
  const result = await runStage(stage)
  results.push(result)
  const seconds = (result.durationMs / 1000).toFixed(1)
  console.log(`${result.ok ? '✓' : '✗'} ${result.name} (${seconds}s)`)
  if (!result.ok && result.output) {
    const tail = result.output.slice(-4000)
    console.log(`\n--- saída de "${stage.name}" ---\n${tail}\n`)
  }
}

const failed = results.filter(result => !result.ok)
const passed = results.length - failed.length
const totalSeconds = (results.reduce((sum, result) => sum + result.durationMs, 0) / 1000).toFixed(1)
console.log(`\n${passed}/${results.length} etapas passaram em ${totalSeconds}s.`)
if (failed.length > 0) {
  console.error(`Etapas com falha: ${failed.map(result => result.name).join('; ')}`)
  process.exit(1)
}
console.log('Regressão concluída sem falhas.')
