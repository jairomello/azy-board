import { describe, expect, test } from 'bun:test'
import i18n from '../i18n'
import { EDITABLE_TASK_STATUSES, taskStatusLabel } from './taskStatus'

describe('catálogo de status editável', () => {
  test('cobre os sete status do fluxo, sem arquivamento', () => {
    expect([...EDITABLE_TASK_STATUSES]).toEqual([
      'NOT_STARTED',
      'PLANNED',
      'IN_PROGRESS',
      'IN_HOMOLOGATION',
      'BLOCKED',
      'DONE',
      'CANCELLED',
    ])
  })

  test('tem rótulo próprio nos três idiomas, sem cair no código do status', async () => {
    for (const language of ['pt-BR', 'en', 'es']) {
      await i18n.changeLanguage(language)
      for (const status of EDITABLE_TASK_STATUSES) {
        const label = taskStatusLabel(i18n.t, status)
        expect(label).not.toBe(status)
        expect(label.trim().length).toBeGreaterThan(0)
      }
    }
    await i18n.changeLanguage('pt-BR')
  })

  test('valor fora do catálogo cai no próprio código, sem inventar rótulo', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(taskStatusLabel(i18n.t, 'ARCHIVED')).toBe('ARCHIVED')
    expect(taskStatusLabel(i18n.t, 'DESCONHECIDO')).toBe('DESCONHECIDO')
  })
})
