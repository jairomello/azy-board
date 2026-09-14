import { and, eq, inArray } from 'drizzle-orm'
import type { AnalyticsDb } from './analytics'
import {
  attachments, assistantConversations, checklists, checklistItems, columns, itemLogs,
  itemSprints, itemTags, items, memberships, modules, projectCostCenters, projectVersions,
  projects, squads, sprints, tags,
} from '../db/schema'
import { enqueueStorageCleanup } from './storageCleanup'
import { appendAnalyticsEvent, snapshotItem } from './analytics'

// [TENANT] Todo executor abaixo recebe tenantId e aplica o filtro em cada leitura
// e delete — nenhum caminho acessa dados de outro tenant.
// [DB-SWAP] Em PostgreSQL, os mesmos deletes valem; avaliar ON DELETE CASCADE.

// SQLite limita variáveis por statement; lotes mantêm o plano viável em
// projetos grandes preservando uma única transação por operação.
const CHUNK_SIZE = 400

export type DeletionTx = AnalyticsDb

export interface DeleteItemsInput {
  tenantId: string
  projectId: string
  itemIds: string[]
  actorId: string
  origin: 'REST' | 'MCP'
  recordAnalyticsEvents?: boolean
}

export interface DeletionOutcome {
  deletedCount: number
  storagePaths: string[]
}

function chunk<T>(values: T[], size = CHUNK_SIZE): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < values.length; i += size) pages.push(values.slice(i, i + size))
  return pages
}

// 3.1 — carrega a subárvore do item nível a nível (BFS em lotes por pai),
// sempre filtrando tenant + projeto. Evita um IN gigante por vez e nunca
// atravessa a fronteira do tenant: o filtro obrigatório isola cada nível.
export async function collectItemSubtreeIds(
  exec: DeletionTx,
  tenantId: string,
  projectId: string,
  rootItemId: string,
): Promise<string[]> {
  const allIds: string[] = [rootItemId]
  const queue: string[] = [rootItemId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    // [TENANT] Anti-IDOR: filtra por tenantId + projectId em cada nível
    const children = await exec.select({ id: items.id })
      .from(items)
      .where(and(eq(items.parentId, parentId), eq(items.projectId, projectId), eq(items.tenantId, tenantId)))
    for (const child of children) {
      allIds.push(child.id)
      queue.push(child.id)
    }
  }
  return allIds
}

// 3.2 — executor transacional da exclusão de itens e seus dependentes.
// Deve ser chamado DENTRO de db.transaction; os caminhos de anexos são coletados
// antes dos deletes e enfileirados como jobs de limpeza na mesma transação
// (outbox), garantindo que nenhum job sobreviva a um rollback.
export async function deleteItemsCascade(
  tx: DeletionTx,
  input: DeleteItemsInput,
): Promise<DeletionOutcome> {
  const { tenantId, projectId, itemIds, actorId, origin } = input
  const recordEvents = input.recordAnalyticsEvents ?? true

  // Snapshots de eventos dos itens e dos pais diretos (comportamento original da rota)
  const snapshots = new Map<string, Awaited<ReturnType<typeof snapshotItem>>>()
  const parentSnapshots = new Map<string, Awaited<ReturnType<typeof snapshotItem>>>()
  if (recordEvents) {
    for (const id of itemIds) snapshots.set(id, await snapshotItem(tx, tenantId, projectId, id))
    for (const snapshot of snapshots.values()) {
      if (snapshot?.parentId && !parentSnapshots.has(snapshot.parentId)) {
        parentSnapshots.set(snapshot.parentId, await snapshotItem(tx, tenantId, projectId, snapshot.parentId))
      }
    }
  }

  // Caminhos dos anexos coletados ANTES de remover os metadados
  const storagePaths: string[] = []
  for (const page of chunk(itemIds)) {
    const rows = await tx.select({ storagePath: attachments.storagePath })
      .from(attachments)
      // [TENANT] anexo sempre do tenant autenticado
      .where(and(inArray(attachments.itemId, page), eq(attachments.tenantId, tenantId)))
    storagePaths.push(...rows.map(row => row.storagePath))
  }

  // [INTEGRIDADE] Ordem respeita FKs NO ACTION: netos antes de filhos antes de pais
  for (const page of chunk(itemIds)) {
    const checklistRows = await tx.select({ id: checklists.id })
      .from(checklists)
      .where(and(inArray(checklists.itemId, page), eq(checklists.tenantId, tenantId)))
    const checklistIds = checklistRows.map(row => row.id)
    if (checklistIds.length > 0) {
      await tx.delete(checklistItems).where(and(inArray(checklistItems.checklistId, checklistIds), eq(checklistItems.tenantId, tenantId)))
      await tx.delete(checklists).where(and(inArray(checklists.id, checklistIds), eq(checklists.tenantId, tenantId)))
    }
    // item_tags/item_sprints possuem tenant_id no próprio vínculo
    await tx.delete(itemTags).where(and(inArray(itemTags.itemId, page), eq(itemTags.tenantId, tenantId)))
    await tx.delete(itemSprints).where(and(inArray(itemSprints.itemId, page), eq(itemSprints.tenantId, tenantId)))
    await tx.delete(attachments).where(and(inArray(attachments.itemId, page), eq(attachments.tenantId, tenantId)))
    await tx.delete(itemLogs).where(and(inArray(itemLogs.itemId, page), eq(itemLogs.tenantId, tenantId)))
    // A subárvore é excluída em uma única instrução por lote; a auto-FK
    // parent_id é satisfeita ao fim de cada statement.
    await tx.delete(items).where(and(inArray(items.id, page), eq(items.projectId, projectId), eq(items.tenantId, tenantId)))
  }

  // Outbox: jobs de limpeza na MESMA transação que remove os metadados
  await enqueueStorageCleanup(tx, tenantId, storagePaths.map(storagePath => ({ storagePath })))

  if (recordEvents) {
    for (const id of itemIds) {
      await appendAnalyticsEvent(tx, {
        tenantId, projectId, itemId: id, eventType: 'ITEM_DELETED', actorId, origin,
        before: snapshots.get(id) ?? null, after: null,
      })
    }
    for (const [parentId, before] of parentSnapshots) {
      if (before) {
        await appendAnalyticsEvent(tx, {
          tenantId, projectId, itemId: parentId, eventType: 'LEAF_CHANGED', actorId, origin,
          before, after: { ...before, isLeaf: true },
        })
      }
    }
  }

  return { deletedCount: itemIds.length, storagePaths }
}

// 3.3 — executor transacional da exclusão de projeto: reutiliza o executor de
// itens para toda a subárvore do projeto e cobre os recursos de projeto
// (colunas, módulos, sprints, tags, versões, centros de custo, squads,
// memberships e conversas do agente). As tabelas de analytics/coverage
// (item_events, sprint_cycles, coverage) são removidas pela FK em cascata
// quando a linha do projeto é excluída.
export async function deleteProjectCascade(
  tx: DeletionTx,
  input: {
    tenantId: string
    projectId: string
    actorId: string
    origin: 'REST' | 'MCP'
  },
): Promise<DeletionOutcome> {
  const { tenantId, projectId, actorId, origin } = input

  // [TENANT] IDs coletados exclusivamente do projeto do tenant autenticado,
  // em lotes para não carregar o projeto inteiro em memória de uma vez.
  const itemIds: string[] = []
  for (const page of await selectProjectItemIds(tx, tenantId, projectId)) itemIds.push(...page)

  // [INTEGRIDADE] projects.simple_story_id → items (NO ACTION): anular antes
  // de excluir os itens do projeto.
  if (itemIds.length > 0) {
    await tx.update(projects).set({ simpleStoryId: null })
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
  }

  const itemsOutcome = await deleteItemsCascade(tx, {
    tenantId, projectId, itemIds, actorId, origin, recordAnalyticsEvents: false,
  })

  // [TENANT] Todas as entidades são limitadas ao projeto e tenant antes da exclusão.
  const tagRows = await tx.select({ id: tags.id }).from(tags)
    .where(and(eq(tags.projectId, projectId), eq(tags.tenantId, tenantId)))
  const tagIds = tagRows.map(row => row.id)
  for (const page of chunk(tagIds)) {
    await tx.delete(itemTags).where(and(inArray(itemTags.tagId, page), eq(itemTags.tenantId, tenantId)))
  }
  const sprintRows = await tx.select({ id: sprints.id }).from(sprints)
    .where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, tenantId)))
  const sprintIds = sprintRows.map(row => row.id)
  for (const page of chunk(sprintIds)) {
    await tx.delete(itemSprints).where(and(inArray(itemSprints.sprintId, page), eq(itemSprints.tenantId, tenantId)))
  }

  await tx.delete(memberships).where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, tenantId)))
  await tx.delete(tags).where(and(eq(tags.projectId, projectId), eq(tags.tenantId, tenantId)))
  await tx.delete(sprints).where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, tenantId)))
  await tx.delete(projectVersions).where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, tenantId)))
  await tx.delete(projectCostCenters).where(and(eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, tenantId)))
  await tx.delete(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, tenantId)))
  await tx.delete(columns).where(and(eq(columns.projectId, projectId), eq(columns.tenantId, tenantId)))
  await tx.delete(squads).where(and(eq(squads.projectId, projectId), eq(squads.tenantId, tenantId)))
  // [TENANT] Conversas do agente vinculadas ao projeto; messages/runs/events/
  // toolCalls/approvals são removidos pelas FKs em cascata do banco.
  await tx.delete(assistantConversations).where(and(eq(assistantConversations.projectId, projectId), eq(assistantConversations.tenantId, tenantId)))
  await tx.delete(projects).where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))

  return itemsOutcome
}

// Carregamento paginado dos itens do projeto (3.1 reutilizado pelo executor de projeto)
async function selectProjectItemIds(tx: DeletionTx, tenantId: string, projectId: string): Promise<string[][]> {
  // [TENANT] Somente itens do projeto do tenant autenticado
  const rows = await tx.select({ id: items.id })
    .from(items)
    .where(and(eq(items.projectId, projectId), eq(items.tenantId, tenantId)))
  return chunk(rows.map(row => row.id))
}
