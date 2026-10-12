// Marcador de última alteração (T57) — cálculo dos ancestrais a tocar.
//
// Toda mutação no card ou em um registro dependente deve atualizar o `updated_at`
// do item dono e dos seus ancestrais (subtask → task → story → épico). Os
// ancestrais já vêm desnormalizados em `ancestry_path`, então a propagação é
// resolvida em uma única sentença (bounded pela profundidade), sem recursão.
//
// Este módulo é puro e compartilhado entre os adapters SQLite e PostgreSQL.
import type { Database } from 'bun:sqlite'

interface AncestryNodeLike { id?: unknown }

/** IDs dos ancestrais presentes no `ancestry_path` (deduplicados, na ordem). */
export function parseAncestorIds(ancestryPath: string | null | undefined): string[] {
  if (!ancestryPath) return []
  try {
    const parsed = JSON.parse(ancestryPath) as unknown
    if (!Array.isArray(parsed)) return []
    const ids: string[] = []
    for (const node of parsed) {
      const id = (node as AncestryNodeLike)?.id
      if (typeof id === 'string' && id.length > 0 && !ids.includes(id)) ids.push(id)
    }
    return ids
  } catch {
    return []
  }
}

/** Item alterado + seus ancestrais, em ordem (item primeiro). */
export function touchedItemIds(itemId: string, ancestryPath: string | null | undefined): string[] {
  return [itemId, ...parseAncestorIds(ancestryPath).filter(id => id !== itemId)]
}

/**
 * Atualiza `updated_at` do item e dos ancestrais em UMA sentença (SQLite).
 * [TENANT] Restringe a atualização ao tenant e ao projeto do item.
 */
export function touchItemMarkerSqlite(
  sqlite: Database, tenantId: string, projectId: string, itemId: string, now = new Date().toISOString(),
): void {
  const row = sqlite.query<{ ancestryPath: string }, [string, string, string]>(
    'SELECT ancestry_path AS ancestryPath FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?',
  ).get(tenantId, projectId, itemId)
  if (!row) return
  const ids = touchedItemIds(itemId, row.ancestryPath)
  const placeholders = ids.map(() => '?').join(', ')
  sqlite.query(`UPDATE items SET updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id IN (${placeholders})`)
    .run(now, tenantId, projectId, ...ids)
}
