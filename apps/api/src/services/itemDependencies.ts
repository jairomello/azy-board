import type { ItemDependencyRecord } from '../persistence/models'

/**
 * Verifica se criar a dependência "origin depende de target" fecharia um ciclo
 * no grafo de dependências do projeto. Percorre a cadeia de "depende de" a
 * partir de `target`: se alcançar `origin`, o vínculo seria circular. BFS em
 * memória sobre as arestas já carregadas do projeto (listByProject).
 */
export function wouldCreateCycle(edges: ItemDependencyRecord[], origin: string, target: string): boolean {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.itemId === edge.dependsOnItemId) continue
    const list = adjacency.get(edge.itemId)
    if (list) list.push(edge.dependsOnItemId)
    else adjacency.set(edge.itemId, [edge.dependsOnItemId])
  }

  const visited = new Set<string>()
  const queue = [target]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === origin) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of adjacency.get(current) ?? []) queue.push(next)
  }
  return false
}