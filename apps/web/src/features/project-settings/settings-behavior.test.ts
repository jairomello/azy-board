import { describe, expect, test } from 'bun:test'
import {
  batchSummaryMessage,
  canAccessProjectSettings,
  defaultSquadId,
  memberGridState,
  runDeleteMutation,
  runSettingsMutation,
  selectedMemberCount,
  selectionFromRow,
  selectionPayload,
  toggleSelection,
  updateRowSelection,
  updateSettingsField,
} from './model/behavior'
import type { MemberBatchResult, MemberSelectionMap, ProjectSettingsData, Squad } from './model/types'

const data: ProjectSettingsData = {
  projectName: 'Projeto', manager: null, managerUserId: '', boardMode: 'HIERARCHICAL',
  isRestricted: false, isHidden: false, advancedChecklists: false, hideModules: false, hideEpics: false, startDate: '', plannedEndDate: '', plannedPoints: '', plannedHours: '', scope: '', icon: null, color: null,
}

describe('comportamentos observáveis das seções de Settings', () => {
  test('preserva o estado de outras seções ao atualizar um campo', () => {
    const next = updateSettingsField(data, 'plannedPoints', '8')
    expect(JSON.stringify(next)).toBe(JSON.stringify({ ...data, plannedPoints: '8' }))
    expect(next.projectName).toBe('Projeto')
  })

  test('expõe sucesso e encerra o estado de salvamento', async () => {
    const events: string[] = []
    await runSettingsMutation({
      execute: async () => 'ok', onStart: () => events.push('saving'), onSuccess: value => events.push(value),
      onError: () => events.push('error'), onFinally: () => events.push('idle'),
    })
    expect(JSON.stringify(events)).toBe(JSON.stringify(['saving', 'ok', 'idle']))
  })

  test('comunica erro e preserva a oportunidade de nova tentativa', async () => {
    const events: string[] = []
    let failure: unknown
    try {
      await runSettingsMutation({
        execute: async () => { throw new Error('falha ao salvar') }, onStart: () => events.push('saving'),
        onError: error => events.push((error as Error).message), onFinally: () => events.push('idle'),
      })
    } catch (error) { failure = error }
    expect((failure as Error).message).toBe('falha ao salvar')
    expect(JSON.stringify(events)).toBe(JSON.stringify(['saving', 'falha ao salvar', 'idle']))
  })

  test('bloqueia somente o grupo sem permissão', () => {
    expect(canAccessProjectSettings('TEAM_MEMBER')).toBe(false)
    expect(canAccessProjectSettings('MEMBER')).toBe(true)
    expect(canAccessProjectSettings('ADMIN')).toBe(true)
  })

  test('não aplica o estado local quando a exclusão falha', async () => {
    const events: string[] = []
    const result = await runDeleteMutation({
      execute: async () => { throw new Error('falha ao excluir') },
      onSuccess: () => events.push('success'),
      onError: error => events.push(`error:${(error as Error).message}`),
    })
    expect(result).toBe(false)
    expect(JSON.stringify(events)).toBe(JSON.stringify(['error:falha ao excluir']))
  })

  test('aplica o estado local quando a exclusão é confirmada', async () => {
    const events: string[] = []
    const result = await runDeleteMutation({
      execute: async () => undefined,
      onSuccess: () => events.push('success'),
      onError: () => events.push('error'),
    })
    expect(result).toBe(true)
    expect(JSON.stringify(events)).toBe(JSON.stringify(['success']))
  })
})

describe('grade de adição de membros em lote', () => {
  const squads: Squad[] = [{ id: 's1', name: 'Squad Alfa', memberCount: 0 }]
  const manySquads: Squad[] = [...squads, { id: 's2', name: 'Squad Beta', memberCount: 0 }]

  test('squad pré-definido depende da quantidade de squads do projeto', () => {
    expect(defaultSquadId([])).toBe('')
    expect(defaultSquadId(squads)).toBe('s1')
    expect(defaultSquadId(manySquads)).toBe('')
  })

  test('linha nova começa como MEMBER e sem marcação', () => {
    expect(selectionFromRow('s1')).toEqual({ selected: false, role: 'MEMBER', squadId: 's1' })
  })

  test('alterna a marcação preservando as demais linhas', () => {
    let selection: MemberSelectionMap = {}
    selection = toggleSelection(selection, 'u1', 's1')
    selection = toggleSelection(selection, 'u2', 's1')
    expect(selectedMemberCount(selection)).toBe(2)

    selection = toggleSelection(selection, 'u1', 's1')
    expect(selectedMemberCount(selection)).toBe(1)
    expect(selection.u1).toMatchObject({ selected: false, role: 'MEMBER', squadId: 's1' })
    expect(selection.u2).toMatchObject({ selected: true })
  })

  test('papel e squad são por linha e não afetam as outras', () => {
    let selection: MemberSelectionMap = {}
    selection = toggleSelection(selection, 'u1', '')
    selection = toggleSelection(selection, 'u2', '')
    selection = updateRowSelection(selection, 'u1', { role: 'VIEWER', squadId: 's2' }, '')

    expect(selectionPayload(selection)).toEqual([
      { userId: 'u1', role: 'VIEWER', squadId: 's2' },
      { userId: 'u2', role: 'MEMBER', squadId: null },
    ])
  })

  test('envia apenas as linhas marcadas, com squad vazio virando null', () => {
    let selection: MemberSelectionMap = {}
    selection = toggleSelection(selection, 'u1', '')
    selection = toggleSelection(selection, 'u2', 's1')
    selection = toggleSelection(selection, 'u2', 's1')

    expect(selectedMemberCount(selection)).toBe(1)
    expect(selectionPayload(selection)).toEqual([{ userId: 'u1', role: 'MEMBER', squadId: null }])
    expect(selectionPayload({})).toEqual([])
  })

  test('estado da grade prioriza erro e distingue vazio de pronto', () => {
    expect(memberGridState({ loading: false, hasError: true, hasRows: true })).toBe('error')
    expect(memberGridState({ loading: true, hasError: false, hasRows: false })).toBe('loading')
    expect(memberGridState({ loading: false, hasError: false, hasRows: true })).toBe('ready')
    expect(memberGridState({ loading: false, hasError: false, hasRows: false })).toBe('empty')
  })

  test('resumo do lote omite as partes zeradas', () => {
    const t = (key: string, options?: { count: number }) => `${key}:${options?.count ?? 0}`
    const created: MemberBatchResult = { ok: true, created: ['u1', 'u2'], skipped: [], invalid: [] }
    expect(batchSummaryMessage(created, t)).toBe('settings:memberBatchCreated:2')

    const mixed: MemberBatchResult = {
      ok: true, created: ['u1'],
      skipped: [{ userId: 'u2', reason: 'ALREADY_MEMBER' }],
      invalid: [{ userId: 'u3', reason: 'SQUAD_NOT_IN_PROJECT' }],
    }
    expect(batchSummaryMessage(mixed, t))
      .toBe('settings:memberBatchCreated:1 settings:memberBatchSkipped:1 settings:memberBatchInvalid:1')

    const empty: MemberBatchResult = { ok: true, created: [], skipped: [], invalid: [] }
    expect(batchSummaryMessage(empty, t)).toBe('settings:memberBatchNothing:0')
  })
})
