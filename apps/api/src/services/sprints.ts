import type { SprintStatus } from '@azy-board/domain'

export const SPRINT_STATUSES = ['PROPOSED', 'OPEN', 'CLOSED'] as const

export function validateSprintDates(name: unknown, startDate: unknown, endDate: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'Nome da sprint é obrigatório'
  if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return 'Data de início é obrigatória e deve ser ISO (AAAA-MM-DD)'
  if (typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return 'Data de fim é obrigatória e deve ser ISO (AAAA-MM-DD)'
  if (startDate > endDate) return 'Data de início não pode ser posterior à data de fim'
  return null
}

export function validateSprintTransition(status: SprintStatus, action: 'open' | 'close'): string | null {
  if (action === 'open' && status !== 'PROPOSED') return status === 'CLOSED' ? 'Sprint fechada não pode ser reaberta' : 'Apenas sprints propostas podem ser abertas'
  if (action === 'close' && status !== 'OPEN') return 'Apenas sprints abertas podem ser fechadas'
  return null
}
