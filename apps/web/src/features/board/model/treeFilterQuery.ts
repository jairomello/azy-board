// Query string do recorte da árvore.
//
// A grade da árvore busca os itens no endpoint `/items/tree`; portanto TODO filtro
// de população ativo no board precisa viajar na requisição. Antes só módulo,
// responsável, sprint e tags eram enviados, e os demais filtros (status,
// prioridade, versão, autor, centro de custo, tipo, squad e última alteração)
// ficavam restritos ao kanban — a árvore exibia itens fora do recorte.
import type { BoardFilterState } from '../../../components/BoardFilters'

export function buildTreeFilterQuery(filters: Partial<BoardFilterState> | undefined): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.moduleId) params.set('moduleId', filters.moduleId)
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId)
  if (filters.sprintId) params.set('sprintId', filters.sprintId)
  if (filters.tagIds?.length) params.set('tagIds', filters.tagIds.join(','))
  if (filters.status) params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.versionId) params.set('versionId', filters.versionId)
  if (filters.authorId) params.set('authorId', filters.authorId)
  if (filters.costCenterId) params.set('costCenterId', filters.costCenterId)
  if (filters.squadId) params.set('squadId', filters.squadId)
  if (filters.types?.length) params.set('types', filters.types.join(','))
  if (filters.updatedWithin) params.set('updatedWithin', filters.updatedWithin)
  return params.toString()
}
