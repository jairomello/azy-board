import { describe, expect, test } from 'bun:test'
import { canAccessProjectSettings, runSettingsMutation, updateSettingsField } from './model/behavior'
import type { ProjectSettingsData } from './model/types'

const data: ProjectSettingsData = {
  projectName: 'Projeto', manager: null, managerUserId: '', boardMode: 'HIERARCHICAL',
  isRestricted: false, isHidden: false, advancedChecklists: false, startDate: '', plannedEndDate: '', plannedPoints: '', plannedHours: '', scope: '',
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
})
