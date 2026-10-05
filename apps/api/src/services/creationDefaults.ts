// Card T35 — defaults determinísticos aplicados na criação de cards.
//
// Resolve, no projeto do tenant, a sprint vigente e a versão vigente para
// vincular automaticamente cards (TASK/BUG) criados sem valor explícito, e
// define o ícone default persistido. Tudo determinístico e sem I/O de escrita.
import { DEFAULT_ITEM_ICON } from '@azy-board/ui-contracts'
import { persistence } from '../persistence/runtime'
import type { PersistenceContext, ProjectVersionRecord, SprintRecord } from '../persistence/models'

// Data corrente em UTC (YYYY-MM-DD): determinismo independente do fuso do servidor.
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function isWorkCard(type: string | null | undefined): boolean {
  return type === 'TASK' || type === 'BUG'
}

// [TENANT] Sprint vigente: status OPEN e data atual dentro de [startDate, endDate].
// Empate (janelas sobrepostas) → menor createdAt (a mais antiga).
export async function resolveActiveSprint(scope: PersistenceContext, projectId: string, now: Date = new Date()): Promise<SprintRecord | null> {
  const today = todayUtc(now)
  const sprints = await persistence.planning.listSprints(scope, projectId)
  const candidates = sprints
    .filter(sprint => sprint.status === 'OPEN' && sprint.startDate <= today && today <= sprint.endDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return candidates[0] ?? null
}

// [TENANT] Versão vigente: não cancelada, com releaseDate futura mais próxima.
// Versões sem data não são candidatas; empate → menor createdAt.
export async function resolveActiveVersion(scope: PersistenceContext, projectId: string, now: Date = new Date()): Promise<ProjectVersionRecord | null> {
  const today = todayUtc(now)
  const versions = await persistence.planning.listVersions(scope, projectId)
  const candidates = versions
    .filter(version => version.status !== 'CANCELLED' && version.releaseDate != null && version.releaseDate >= today)
    .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '') || a.createdAt.localeCompare(b.createdAt))
  return candidates[0] ?? null
}

export { DEFAULT_ITEM_ICON }
