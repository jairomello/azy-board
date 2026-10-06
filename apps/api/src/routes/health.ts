import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { resolveInstallProfile } from '../db/installProfile'
import { createStorageAdapter } from '../services/storage'

const profile = resolveInstallProfile()

/** Probes tipados e limitados injetados pelo composition root. */
export interface ReadinessProbes {
  database(): Promise<void>
  storage(): Promise<void>
  coordination(): Promise<void>
}

let injectedProbes: ReadinessProbes | null = null

/**
 * Registra as dependências reais compostas no boot. Em ADVANCED a coordenação
 * é obrigatória; um probe ausente reprova readiness.
 */
export function configureReadinessProbes(next: ReadinessProbes | null): void {
  injectedProbes = next
}

const PROBE_TIMEOUT_MS = 3_000

async function runProbe(probe: (() => Promise<void>) | undefined): Promise<boolean> {
  if (!probe) return false
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('probe timeout')), PROBE_TIMEOUT_MS)
      }),
    ])
    return true
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Probes do runtime já composto (persistência + coordenação do processo). */
export async function runtimeReadinessProbes(): Promise<ReadinessProbes> {
  const { persistence, getCoordination } = await import('../persistence/runtime')
  return {
    // [DB-SWAP] Consulta limitada; nunca dispara cutover/backfill por requisição.
    database: () => persistence.health.ping(),
    storage: async () => {
      const { access } = await import('node:fs/promises')
      const adapter = createStorageAdapter()
      const baseDir = (adapter as unknown as { baseDir: string }).baseDir || './uploads'
      await access(baseDir)
    },
    coordination: async () => {
      const ready = await getCoordination().isReady()
      if (!ready) throw new Error('coordination unavailable')
    },
  }
}

export const healthRouter = new Hono<HonoEnv>()

// GET /health/live — público, sem autenticação
// Retorna 200 enquanto o processo está apto a atender requisições.
// Corpo mínimo: sem versões, caminhos ou IDs.
healthRouter.get('/live', (c) => {
  return c.json({ status: 'ok' })
})

// GET /health/ready — público, sem autenticação
// Verifica banco, storage e (no ADVANCED) coordenação.
// 200 quando tudo responde; 503 listando nomes das dependências falhas.
healthRouter.get('/ready', async (c) => {
  const failures: string[] = []

  let probes: ReadinessProbes | null = injectedProbes
  if (!probes) {
    try {
      probes = await runtimeReadinessProbes()
    } catch {
      probes = null
    }
  }

  if (!(await runProbe(probes?.database))) failures.push('database')
  if (!(await runProbe(probes?.storage))) failures.push('storage')
  // [DB-SWAP] Coordenação ausente/indisponível em ADVANCED é falha, não sucesso
  // opcional; SIMPLE não depende de coordenação externa.
  if (profile.profile === 'ADVANCED' && !(await runProbe(probes?.coordination))) {
    failures.push('coordination')
  }

  if (failures.length > 0) {
    return c.json({ status: 'error', dependencies: failures }, 503)
  }

  return c.json({ status: 'ok' })
})
