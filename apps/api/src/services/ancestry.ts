import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { items } from '../db/schema'
import type { AncestorNode } from '@azy-board/types'

// [HIERARQUIA] Aceita o `db` global ou o `tx` de uma transação: cascatas de
// reparenting e rename precisam rodar DENTRO da mesma transação que atualiza o item.
export type AncestryDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

// Limite defensivo de profundidade: protege contra dados já corrompidos e
// interrompe caminhadas em caso de ciclo pré-existente.
const MAX_ANCESTRY_DEPTH = 50

// Constrói o ancestry_path de um item a partir do seu pai imediato
// Aproveita o ancestryPath já desnormalizado do pai para O(1) na cadeia
export async function buildAncestryPath(
  tx: AncestryDb,
  tenantId: string,
  parentId: string
): Promise<AncestorNode[]> {
  // [TENANT] sempre filtra por tenantId
  const parent = await tx.query.items.findFirst({
    where: (i) => and(eq(i.id, parentId), eq(i.tenantId, tenantId)),
  })
  if (!parent) return []

  const parentPath: AncestorNode[] = (() => {
    try { return JSON.parse(parent.ancestryPath || '[]') } catch { return [] }
  })()

  return [...parentPath, { id: parent.id, title: parent.title, type: parent.type }]
}

// [HIERARQUIA] Detecta ciclo ANTES da escrita de um reparenting: sobe a cadeia
// de pais a partir de newParentId; se alcançar itemId (ou um nó já visitado,
// indicando dado pré-corrompido), o reparenting criaria/manteria um ciclo.
export async function detectReparentCycle(
  tx: AncestryDb,
  tenantId: string,
  projectId: string,
  itemId: string,
  newParentId: string
): Promise<boolean> {
  let currentId: string | null = newParentId
  const visited = new Set<string>()
  for (let depth = 0; currentId && depth < MAX_ANCESTRY_DEPTH; depth++) {
    if (currentId === itemId) return true
    if (visited.has(currentId)) return true
    visited.add(currentId)
    const node = await tx.query.items.findFirst({
      where: (i) => and(eq(i.id, currentId!), eq(i.projectId, projectId), eq(i.tenantId, tenantId)),
      columns: { parentId: true },
    })
    currentId = node?.parentId ?? null
  }
  // Cadeia mais profunda que o limite: tratar como inválida (defesa contra dados corrompidos).
  return currentId !== null
}

// Atualiza ancestry_path em cascata para todos os filhos quando um ancestral é
// reparentado ou renomeado. Deve rodar na mesma transação do update do item,
// DEPOIS que o item foi atualizado, para que os descendentes leiam o caminho novo.
// [TENANT] Sempre filtra por tenantId para não afetar outros tenants
// [DB-SWAP] PostgreSQL permite UPDATE em cascata mais eficiente com CTEs recursivas
export async function updateDescendantAncestry(
  tx: AncestryDb,
  tenantId: string,
  parentId: string,
  visiting: Set<string> = new Set()
): Promise<void> {
  if (visiting.has(parentId)) return // defesa contra dados já cíclicos
  visiting.add(parentId)

  const children = await tx.query.items.findMany({
    where: (i) => and(eq(i.parentId, parentId), eq(i.tenantId, tenantId)),
    columns: { id: true },
  })

  if (children.length > 0) {
    // Todos os filhos diretos compartilham o mesmo caminho.
    const newPath = JSON.stringify(await buildAncestryPath(tx, tenantId, parentId))
    for (const child of children) {
      await tx.update(items)
        .set({ ancestryPath: newPath })
        .where(and(eq(items.id, child.id), eq(items.tenantId, tenantId)))

      // Recursão para filhos dos filhos
      await updateDescendantAncestry(tx, tenantId, child.id, visiting)
    }
  }

  visiting.delete(parentId)
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
