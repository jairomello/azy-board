import type { TFunction } from 'i18next'
import type { TaskStatus } from '@azy-board/domain'

/**
 * Status base que o board edita, na ordem do fluxo.
 *
 * `ARCHIVED` fica fora de propósito: é o estado interno do arquivamento, não
 * uma etapa escolhível na modal nem no seletor de status.
 */
export const EDITABLE_TASK_STATUSES = [
  'NOT_STARTED',
  'PLANNED',
  'IN_PROGRESS',
  'IN_HOMOLOGATION',
  'BLOCKED',
  'DONE',
  'CANCELLED',
] as const satisfies readonly TaskStatus[]

export type EditableTaskStatus = (typeof EDITABLE_TASK_STATUSES)[number]

/**
 * Rótulo do status no idioma ativo (`common:status.*`).
 *
 * Valores fora do catálogo — `ARCHIVED` ou um status legado — caem no próprio
 * código, em vez de virarem um rótulo errado (era o que acontecia quando o
 * cabeçalho da modal rotulava Planejada e Em homologação como Cancelada).
 */
export function taskStatusLabel(t: TFunction, status: string): string {
  return t(`status.${status}`, { defaultValue: status })
}
