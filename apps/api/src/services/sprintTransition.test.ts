import { describe, expect, test } from 'bun:test'
import type { SprintRecord, SprintTransitionCandidate } from '../persistence/models'
import { buildSprintTransitionPlan, candidateFromItem, fingerprintTransition, isEligibleCandidate, resolveNextSprint, validateTransitionDestination } from './sprintTransition'

function sprint(patch: Partial<SprintRecord> & Pick<SprintRecord, 'id' | 'status' | 'startDate'>): SprintRecord {
  return { tenantId: 't', projectId: 'p', name: patch.id, endDate: '2026-11-14', createdAt: '2026-10-01T00:00:00.000Z', ...patch }
}

const source = sprint({ id: 'open', status: 'OPEN', startDate: '2026-10-01', endDate: '2026-10-14' })

describe('transição de sprint T27', () => {
  test('resolve "próxima" pela menor startDate posterior e rejeita empate', () => {
    const next = sprint({ id: 'next', status: 'PROPOSED', startDate: '2026-10-15' })
    const later = sprint({ id: 'later', status: 'PROPOSED', startDate: '2026-11-01' })
    expect(resolveNextSprint(source, [source, later, next]).id).toBe('next')
    expect(() => resolveNextSprint(source, [source, next, sprint({ id: 'tie', status: 'PROPOSED', startDate: '2026-10-15' })])).toThrow('NEXT_SPRINT_AMBIGUOUS')
    expect(() => resolveNextSprint(source, [source])).toThrow('NEXT_SPRINT_NOT_FOUND')
  })

  test('valida destino: igual, CLOSED e projeto divergente', () => {
    expect(() => validateTransitionDestination({ projectId: 'p', source, destination: source })).toThrow('DESTINATION_EQUALS_SOURCE')
    expect(() => validateTransitionDestination({ projectId: 'p', source, destination: sprint({ id: 'c', status: 'CLOSED', startDate: '2026-10-15' }) })).toThrow('DESTINATION_CLOSED')
    expect(() => validateTransitionDestination({ projectId: 'p', source, destination: sprint({ id: 'x', status: 'PROPOSED', startDate: '2026-10-15', projectId: 'other' }) })).toThrow('SPRINT_PROJECT_MISMATCH')
    expect(() => validateTransitionDestination({ projectId: 'p', source, destination: sprint({ id: 'n', status: 'PROPOSED', startDate: '2026-10-15' }) })).not.toThrow()
  })

  test('elegibilidade exige folha, tipo, estado e vínculo com a origem', () => {
    const base = { id: 'i', type: 'TASK' as const, status: 'IN_PROGRESS' as const }
    expect(isEligibleCandidate(base, true, true)).toBe(true)
    expect(isEligibleCandidate(base, false, true)).toBe(false)
    expect(isEligibleCandidate(base, true, false)).toBe(false)
    expect(isEligibleCandidate({ ...base, type: 'STORY' }, true, true)).toBe(false)
    expect(isEligibleCandidate({ ...base, status: 'DONE' }, true, true)).toBe(false)
    expect(isEligibleCandidate({ ...base, status: 'ARCHIVED' }, true, true)).toBe(false)
  })

  test('plano calcula pontos conhecidos/desconhecidos e fingerprint estável', () => {
    const candidates: SprintTransitionCandidate[] = [
      { itemId: 'a', revision: 'r1', status: 'IN_PROGRESS', points: 3, sprintIds: ['open'] },
      { itemId: 'b', revision: 'r2', status: 'BLOCKED', points: null, sprintIds: ['open', 'third'] },
    ]
    const destination = sprint({ id: 'next', status: 'PROPOSED', startDate: '2026-10-15' })
    const plan = buildSprintTransitionPlan({
      projectId: 'p', source, sourceCycleId: 'cycle-1', destination, candidates,
      excluded: { done: 1, cancelled: 0, archived: 0, aggregators: 0 },
    })
    expect(plan.knownPoints).toBe(3)
    expect(plan.unknownPointsCount).toBe(1)
    expect(plan.totalCandidates).toBe(2)
    expect(plan.fingerprint).toBe(fingerprintTransition({ sourceSprintId: 'open', sourceCycleId: 'cycle-1', sourceRevision: 'OPEN', destinationSprintId: 'next', destinationStatus: 'PROPOSED', candidates }))
    // fingerprint muda se um candidato mudar de estado/revisão.
    expect(fingerprintTransition({ sourceSprintId: 'open', sourceCycleId: 'cycle-1', sourceRevision: 'OPEN', destinationSprintId: 'next', destinationStatus: 'PROPOSED', candidates: [{ ...candidates[0]!, status: 'DONE' }, candidates[1]!] })).not.toBe(plan.fingerprint)
  })

  test('origem sem ciclo é rejeitada', () => {
    expect(() => buildSprintTransitionPlan({ projectId: 'p', source, sourceCycleId: '', destination: sprint({ id: 'n', status: 'PROPOSED', startDate: '2026-10-15' }), candidates: [], excluded: { done: 0, cancelled: 0, archived: 0, aggregators: 0 } })).toThrow('SOURCE_WITHOUT_CYCLE')
  })

  test('candidateFromItem ordena vínculos para fingerprint estável', () => {
    const candidate = candidateFromItem({ id: 'i', updatedAt: 'r', status: 'IN_PROGRESS', points: 2, type: 'TASK', itemSprints: [{ sprintId: 'z' }, { sprintId: 'a' }] } as never)
    expect(candidate.sprintIds).toEqual(['a', 'z'])
  })
})
