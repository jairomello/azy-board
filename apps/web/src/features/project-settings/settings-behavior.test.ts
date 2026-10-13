import { describe, expect, test } from 'bun:test'
import { canAccessProjectSettings, filterMemberCandidates, memberCandidateState, runDeleteMutation, runSettingsMutation, updateSettingsField } from './model/behavior'
import type { MemberCandidate, ProjectSettingsData } from './model/types'

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

describe('seletor de membros a partir dos usuários do tenant', () => {
  const candidates: MemberCandidate[] = [
    { id: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', avatarUrl: null, globalGroup: 'TEAM_MEMBER', isMember: false },
    { id: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', avatarUrl: null, globalGroup: 'MANAGER', isMember: true },
    { id: 'u3', name: 'Carla Dias', email: 'carla@outro.com', avatarUrl: null, globalGroup: 'ADMIN', isMember: false },
  ]

  test('filtra por nome sem diferenciar maiúsculas', () => {
    expect(filterMemberCandidates(candidates, 'ana').map(item => item.id)).toEqual(['u1'])
    expect(filterMemberCandidates(candidates, 'BRUNO').map(item => item.id)).toEqual(['u2'])
  })

  test('filtra por e-mail', () => {
    expect(filterMemberCandidates(candidates, 'outro.com').map(item => item.id)).toEqual(['u3'])
    expect(filterMemberCandidates(candidates, 'empresa.com').map(item => item.id)).toEqual(['u1', 'u2'])
  })

  test('termo vazio mantém a lista completa e sem correspondência fica vazia', () => {
    expect(filterMemberCandidates(candidates, '   ').map(item => item.id)).toEqual(['u1', 'u2', 'u3'])
    expect(filterMemberCandidates(candidates, 'inexistente')).toEqual([])
  })

  test('sinaliza quem já é membro sem removê-lo da lista', () => {
    const visible = filterMemberCandidates(candidates, '')
    expect(visible.find(item => item.id === 'u2')).toMatchObject({ isMember: true })
    expect(visible.find(item => item.id === 'u1')).toMatchObject({ isMember: false })
  })

  test('estado do seletor prioriza erro e distingue vazio de pronto', () => {
    expect(memberCandidateState({ loading: false, hasError: true, visible: candidates })).toBe('error')
    expect(memberCandidateState({ loading: true, hasError: false, visible: candidates })).toBe('loading')
    expect(memberCandidateState({ loading: false, hasError: false, visible: candidates })).toBe('ready')
    // Todos já são membros: nada selecionável.
    expect(memberCandidateState({ loading: false, hasError: false, visible: candidates.filter(item => item.isMember) })).toBe('empty')
    expect(memberCandidateState({ loading: false, hasError: false, visible: [] })).toBe('empty')
  })
})
