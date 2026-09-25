import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { resolveInstallProfile } from '../db/installProfile'
import { createStorageAdapter } from '../services/storage'

const profile = resolveInstallProfile()

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

  // Verificar banco de dados via persistence
  // [DB-SWAP] Consulta trivial — driver importado em runtime pelo perfil.
  try {
    const { persistence } = await import('../persistence/runtime')
    await persistence.analytics.assertCutoverReady()
  } catch {
    failures.push('database')
  }

  // Verificar acesso ao diretório de storage
  try {
    const { access } = await import('fs/promises')
    const adapter = createStorageAdapter()
    const baseDir = (adapter as unknown as { baseDir: string }).baseDir || './uploads'
    await access(baseDir)
  } catch {
    failures.push('storage')
  }

  // No perfil ADVANCED, verificar coordenação
  if (profile.profile === 'ADVANCED') {
    try {
      const { persistence } = await import('../persistence/runtime')
      if ('coordination' in persistence) {
        const coord = (persistence as { coordination: { isReady(): Promise<boolean> } }).coordination
        const ready = await coord.isReady()
        if (!ready) failures.push('coordination')
      }
    } catch {
      failures.push('coordination')
    }
  }

  if (failures.length > 0) {
    return c.json({ status: 'error', dependencies: failures }, 503)
  }

  return c.json({ status: 'ok' })
})