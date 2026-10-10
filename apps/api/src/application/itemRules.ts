import type { ItemType } from '@azy-board/domain'
import type { PersistenceContext } from '../persistence/models'
import { persistence } from '../persistence/runtime'
import { nextSequenceCode as computeNextSequenceCode } from '../utils/sequenceCode'

const MAX_ANCESTRY_DEPTH = 50

export function systemContext(tenantId: string): PersistenceContext {
  // [TENANT] Leituras auxiliares usam tenant explícito e actor SYSTEM controlado pelo servidor.
  return { tenantId, actorUserId: null, actorKind: 'SYSTEM' }
}

export function normalizeAuditText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function buildAncestryPath(tenantId: string, projectId: string, parentId: string) {
  const parent = await persistence.items.getItem(systemContext(tenantId), projectId, parentId)
  if (!parent) return []
  let parentPath: Array<{ id: string; title: string; type: string }> = []
  try { parentPath = JSON.parse(parent.ancestryPath || '[]') } catch { parentPath = [] }
  return [...parentPath, { id: parent.id, title: parent.title, type: parent.type }]
}

export async function detectReparentCycle(tenantId: string, projectId: string, itemId: string, newParentId: string): Promise<boolean> {
  const newParent = await persistence.items.getItem(systemContext(tenantId), projectId, newParentId)
  if (!newParent) return false
  let ancestry: Array<{ id: string }> = []
  try { ancestry = JSON.parse(newParent.ancestryPath || '[]') } catch { return true }
  return ancestry.length >= MAX_ANCESTRY_DEPTH || ancestry.some(node => node.id === itemId)
}

export async function nextSequenceCode(tenantId: string, projectId: string, type: string): Promise<string> {
  const rows = await persistence.items.listItems(systemContext(tenantId), projectId)
  return computeNextSequenceCode(rows.map(row => row.sequenceCode), type)
}

export async function isLeaf(tenantId: string, projectId: string, itemId: string): Promise<boolean> {
  return !(await persistence.items.hasChildren(systemContext(tenantId), projectId, itemId))
}

export async function resolveProjectTagIds(tenantId: string, projectId: string, tagIds: string[] | undefined): Promise<string[] | null> {
  const unique = [...new Set(tagIds ?? [])]
  if (unique.length === 0) return []
  // [TENANT] Tags são resolvidas somente dentro do tenant/projeto do comando.
  const valid = await persistence.planning.listTags(systemContext(tenantId), projectId)
  const validIds = new Set(valid.map(tag => tag.id))
  return unique.every(id => validIds.has(id)) ? unique : null
}

export async function loadItemWithRelations(tenantId: string, projectId: string, itemId: string) {
  const rows = await persistence.items.listItemsWithRelations(systemContext(tenantId), projectId)
  return rows.find(item => item.id === itemId) ?? null
}

export async function validateHierarchy(
  tenantId: string,
  projectId: string,
  type: ItemType,
  parentId: string | null | undefined,
  moduleId: string | null | undefined,
): Promise<string | null> {
  if (type === 'EPIC') {
    if (parentId) return 'EPIC não pode ter parentId — EPICs são raiz da hierarquia'
    if (!moduleId) return 'EPIC requer moduleId — use GET /projects/:id/modules para listar os módulos disponíveis'
    return null
  }
  if (type === 'STORY' && !parentId) return 'STORY requer parentId apontando para um EPIC — use GET /projects/:id/items?type=EPIC para listar os EPICs'
  if (!parentId) return null

  const parent = await persistence.items.getItem(systemContext(tenantId), projectId, parentId)
  if (!parent) return `parentId "${parentId}" não encontrado neste projeto`
  if (type === 'STORY' && parent.type !== 'EPIC') return `STORY deve ser filha de EPIC, mas "${parent.title}" (${parentId}) é ${parent.type}`
  if ((type === 'TASK' || type === 'BUG' || type === 'EXTERNAL') && !['STORY', 'TASK', 'BUG', 'EXTERNAL'].includes(parent.type)) {
    return `${type} não pode ser filho direto de ${parent.type} ("${parent.title}"). Hierarquia: EPIC → STORY → TASK/BUG. Crie uma STORY filha do EPIC e use o ID da STORY como parentId.`
  }
  return null
}
