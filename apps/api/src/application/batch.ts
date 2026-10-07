import type { RequestContext } from '@azy-board/api-contracts'
import type { BatchItemCreateOperation, BatchItemUpdate } from '../persistence/ports'
import type { MutationContext } from '../persistence/models'
import { persistence } from '../persistence/runtime'
import { authorizeProjectRole } from '../services/projectAuthorization'
import type { ProjectAuthorizationResult } from '../services/projectAuthorization'

type BatchAuthorization = {
  context: RequestContext
  permissionScope?: readonly string[] | null
  projectId: string
}

type BatchDenial = Extract<ProjectAuthorizationResult, { ok: false }>

/** Aplica atualizações já validadas pelo parser/compositor da rota em uma UoW atômica. */
export async function applyItemBatchApplication(input: BatchAuthorization & {
  mutationContext: MutationContext
  updates: BatchItemUpdate[]
}) {
  const access = await authorizeProjectRole(input.context, input.projectId, 'MEMBER', input.permissionScope)
  if (!access.ok) return access as BatchDenial
  // [DB-SWAP] Adapter aplica todas as mudanças, journal e efeitos no mesmo commit.
  const results = await persistence.unitOfWork.applyItemBatch(input.mutationContext, input.projectId, input.updates)
  return { ok: true as const, results }
}

/** Cria batch dentro do commit único provido pelos adapters T36/T38. */
export async function createItemsBatchApplication(input: BatchAuthorization & {
  mutationContext: MutationContext
  operations: BatchItemCreateOperation[]
  atomic: boolean
  agentRunId?: string | null
}) {
  const access = await authorizeProjectRole(input.context, input.projectId, 'MEMBER', input.permissionScope)
  if (!access.ok) return access as BatchDenial
  // [DB-SWAP] Atomicidade/rollback pertencem ao adapter ativo, sem commit por operação.
  const result = await persistence.unitOfWork.createItemsBatch(input.mutationContext, input.projectId, input.operations, {
    atomic: input.atomic,
    agentRunId: input.agentRunId ?? null,
  })
  return { ok: true as const, result }
}
