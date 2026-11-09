// Regras de movimento (reparenting) na árvore.
//
// A hierarquia do board é EPIC → STORY → TASK/BUG (e TASK/BUG podem ter
// subtarefas). O arraste só é aceito quando o pai de destino respeita essa
// ordem; o servidor revalida com `validateHierarchy` (HIERARCHY_CYCLE incluído).

export interface TreeMoveNode {
  id: string
  type: string
  parentId?: string | null
  moduleId?: string | null
  children?: TreeMoveNode[]
}

export type TreeMovePatch =
  | { parentId: string; moduleId: string | null }
  | { moduleId: string }

const WORK_ITEM_TYPES = ['STORY', 'TASK', 'BUG', 'EXTERNAL']

/** Mapa filho → pai direto para detectar ciclos e ancestrais na árvore exibida. */
export function buildTreeParentMap(nodes: TreeMoveNode[]): Map<string, string> {
  const parentOf = new Map<string, string>()
  function visit(list: TreeMoveNode[], parentId?: string) {
    for (const node of list) {
      if (parentId) parentOf.set(node.id, parentId)
      visit(node.children ?? [], node.id)
    }
  }
  visit(nodes)
  return parentOf
}

export function isTreeDescendant(candidateId: string, ancestorId: string, parentOf: Map<string, string>): boolean {
  let current = parentOf.get(candidateId)
  while (current) {
    if (current === ancestorId) return true
    current = parentOf.get(current)
  }
  return false
}

/**
 * Resolve o patch de hierarquia para soltar `drag` sobre `target`.
 * Retorna null quando o movimento quebraria a hierarquia (ou é no-op).
 *
 * - EPIC → módulo (moduleId; épicos são a raiz da hierarquia)
 * - STORY → épico (parentId)
 * - TASK/BUG/EXTERNAL → história, tarefa ou bug (parentId)
 * - módulo não se move
 */
export function resolveTreeMove(
  drag: TreeMoveNode,
  target: TreeMoveNode,
  parentOf: Map<string, string>,
): TreeMovePatch | null {
  if (drag.id === target.id) return null
  if (drag.type === 'module' || target.type === 'module') {
    if (drag.type !== 'EPIC' || target.type !== 'module') return null
    if (drag.moduleId === target.id) return null
    return { moduleId: target.id }
  }

  // Nenhum item pode virar filho do próprio descendente (ciclo).
  if (isTreeDescendant(target.id, drag.id, parentOf)) return null

  if (drag.type === 'EPIC') return null

  if (drag.type === 'STORY') {
    if (target.type !== 'EPIC') return null
    if (drag.parentId === target.id) return null
    // O módulo acompanha o EPIC de destino: a história não fica órfã de módulo
    // quando muda de épico (e o filtro de módulo continua coerente).
    return { parentId: target.id, moduleId: target.moduleId ?? null }
  }

  if (WORK_ITEM_TYPES.includes(drag.type)) {
    if (!WORK_ITEM_TYPES.includes(target.type)) return null
    if (drag.parentId === target.id) return null
    return { parentId: target.id, moduleId: target.moduleId ?? null }
  }

  return null
}
