import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { items } from '../db/schema'
import type { AncestorNode } from '@azy-board/types'

// Constrói o ancestry_path de um item a partir do seu pai imediato
// Aproveita o ancestryPath já desnormalizado do pai para O(1) na cadeia
export async function buildAncestryPath(
  tenantId: string,
  parentId: string
): Promise<AncestorNode[]> {
  // [TENANT] sempre filtra por tenantId
  const parent = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, parentId), eq(i.tenantId, tenantId)),
  })
  if (!parent) return []

  const parentPath: AncestorNode[] = (() => {
    try { return JSON.parse(parent.ancestryPath || '[]') } catch { return [] }
  })()

  return [...parentPath, { id: parent.id, title: parent.title, type: parent.type }]
}

// Atualiza ancestry_path em cascata para todos os filhos quando um ancestral é renomeado
// [TENANT] Sempre filtra por tenantId para não afetar outros tenants
// [DB-SWAP] PostgreSQL permite UPDATE em cascata mais eficiente com CTEs recursivas
export async function updateDescendantAncestry(
  tenantId: string,
  parentId: string
): Promise<void> {
  const children = await db.query.items.findMany({
    where: (i) => and(eq(i.parentId, parentId), eq(i.tenantId, tenantId)),
  })

  for (const child of children) {
    const newPath = await buildAncestryPath(tenantId, parentId)
    await db.update(items)
      .set({ ancestryPath: JSON.stringify(newPath) })
      .where(and(eq(items.id, child.id), eq(items.tenantId, tenantId)))

    // Recursão para filhos dos filhos
    await updateDescendantAncestry(tenantId, child.id)
  }
}

// Calcula progresso de items pai com base nas tasks folha TASK/BUG descendentes
export async function calculateProgress(
  tenantId: string,
  _projectId: string,
  parentId: string
): Promise<number> {
  const leaves = await getLeafDescendants(tenantId, parentId)
  if (leaves.length === 0) return 0
  const done = leaves.filter(i => i.status === 'DONE').length
  return Math.round((done / leaves.length) * 100)
}

// Calcula soma de pontos das tasks folha TASK/BUG descendentes
export async function calculatePoints(
  tenantId: string,
  parentId: string
): Promise<number> {
  const leaves = await getLeafDescendants(tenantId, parentId)
  return leaves.reduce((sum, i) => sum + (i.points ?? 0), 0)
}

async function getLeafDescendants(
  tenantId: string,
  parentId: string
): Promise<Array<{ id: string; status: string; points: number | null }>> {
  // [DB-SWAP] Para PostgreSQL usar CTE recursiva para maior eficiência
  const children = await db.query.items.findMany({
    where: (i) => and(eq(i.parentId, parentId), eq(i.tenantId, tenantId)),
    columns: { id: true, status: true, points: true, type: true },
  })

  if (children.length === 0) {
    const self = await db.query.items.findFirst({
      where: (i) => and(eq(i.id, parentId), eq(i.tenantId, tenantId)),
      columns: { id: true, status: true, points: true, type: true },
    })
    // Apenas TASK e BUG contribuem para progresso
    if (!self || !['TASK', 'BUG'].includes(self.type)) return []
    return [self]
  }

  const results: Array<{ id: string; status: string; points: number | null }> = []
  for (const child of children) {
    const leaves = await getLeafDescendants(tenantId, child.id)
    results.push(...leaves)
  }
  return results
}
