import type { ActivityActorType, ActivitySource } from '@azy-board/domain'
import type { MutationContext } from '../persistence/models'
import { persistence } from '../persistence/runtime'

type MutationActor = {
  actorType: ActivityActorType
  source: ActivitySource
  actorLabel: string | null
}

function persistenceMutationContext(input: ItemMutationInput): MutationContext {
  return {
    tenantId: input.tenantId,
    actorUserId: input.userId,
    actorKind: 'USER',
    mutation: {
      origin: input.apiKeyId ? 'MCP' : 'REST',
      actorType: input.actor.actorType,
      actorSource: input.actor.source,
      actorLabel: input.actor.actorLabel,
    },
  }
}

type ItemMutationInput = {
  tenantId: string
  projectId: string
  itemId: string
  userId: string
  apiKeyId?: string
  columnId?: string | null
  actor: MutationActor
}

export async function claimItem(input: ItemMutationInput): Promise<boolean> {
  return persistence.unitOfWork.claimItem(
    persistenceMutationContext(input), input.projectId, input.itemId, input.userId, input.apiKeyId, input.columnId,
  )
}

export async function releaseItem(input: ItemMutationInput): Promise<void> {
  await persistence.unitOfWork.releaseItem(persistenceMutationContext(input), input.projectId, input.itemId)
}

export async function moveItem(input: ItemMutationInput & { columnId: string; columnName: string; baseStatus: string; fromColumnName: string }): Promise<void> {
  await persistence.unitOfWork.moveItem(persistenceMutationContext(input), input.projectId, input.itemId, {
    id: input.columnId,
    name: input.columnName,
    baseStatus: input.baseStatus as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE',
  }, input.fromColumnName)
}
