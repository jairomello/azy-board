import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/index'
import { itemLogs, items } from '../db/schema'
import { appendAnalyticsEvent, snapshotItem } from './analytics'
import { generateId } from '../utils/id'
import type { ActivityActorType, ActivitySource } from '@azy-board/types'

type MutationActor = {
  actorType: ActivityActorType
  source: ActivitySource
  actorLabel: string | null
}

type ItemMutationInput = {
  tenantId: string
  projectId: string
  itemId: string
  userId: string
  apiKeyId?: string
  actor: MutationActor
}

export async function claimItem(input: ItemMutationInput): Promise<boolean> {
  return db.transaction(async (tx) => {
    const before = await snapshotItem(tx, input.tenantId, input.projectId, input.itemId)
    const updated = await tx.update(items).set({
      assigneeId: input.userId,
      assigneeApiKeyId: input.apiKeyId ?? null,
      status: 'IN_PROGRESS',
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(items.id, input.itemId),
      eq(items.projectId, input.projectId),
      eq(items.tenantId, input.tenantId),
      isNull(items.assigneeId),
    )).returning({ id: items.id })
    if (!updated.length) return false

    await tx.insert(itemLogs).values({
      id: generateId(), tenantId: input.tenantId, itemId: input.itemId,
      authorId: input.userId, type: 'auto', actorType: input.actor.actorType,
      actorLabel: input.actor.actorLabel, source: input.actor.source,
      activity: 'Card assumido para trabalho', durationMin: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    await appendAnalyticsEvent(tx, {
      tenantId: input.tenantId, projectId: input.projectId, itemId: input.itemId,
      eventType: 'STATUS_CHANGED', actorId: input.userId,
      origin: input.apiKeyId ? 'MCP' : 'REST', before,
      after: await snapshotItem(tx, input.tenantId, input.projectId, input.itemId),
    })
    return true
  })
}

export async function releaseItem(input: ItemMutationInput): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await snapshotItem(tx, input.tenantId, input.projectId, input.itemId)
    await tx.update(items).set({ assigneeId: null, assigneeApiKeyId: null, status: 'NOT_STARTED', updatedAt: new Date().toISOString() })
      .where(and(eq(items.id, input.itemId), eq(items.projectId, input.projectId), eq(items.tenantId, input.tenantId)))
    await tx.insert(itemLogs).values({
      id: generateId(), tenantId: input.tenantId, itemId: input.itemId,
      authorId: input.userId, type: 'auto', actorType: input.actor.actorType,
      actorLabel: input.actor.actorLabel, source: input.actor.source,
      activity: 'Trabalho liberado', durationMin: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    await appendAnalyticsEvent(tx, {
      tenantId: input.tenantId, projectId: input.projectId, itemId: input.itemId,
      eventType: 'STATUS_CHANGED', actorId: input.userId,
      origin: input.apiKeyId ? 'MCP' : 'REST', before,
      after: await snapshotItem(tx, input.tenantId, input.projectId, input.itemId),
    })
  })
}
