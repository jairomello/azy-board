import { describe, expect, test } from 'bun:test'
import { changePasswordSchema } from './validation'

const valid = { currentPassword: 'OldPass123!', newPassword: 'NewPass456!', confirmPassword: 'NewPass456!' }

describe('changePasswordSchema — política da nova senha', () => {
  test('aceita senha dentro da política com confirmação idêntica', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true)
  })

  test('rejeita confirmação divergente no campo confirmPassword', () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: 'Outra456!' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.path.includes('confirmPassword'))).toBe(true)
  })

  test('rejeita senha abaixo do comprimento mínimo', () => {
    expect(changePasswordSchema.safeParse({ ...valid, newPassword: 'Ab1!', confirmPassword: 'Ab1!' }).success).toBe(false)
  })

  test('exige maiúscula, número e símbolo', () => {
    for (const candidate of ['newpass456!', 'NewPass!xyz', 'NewPass456x']) {
      expect(changePasswordSchema.safeParse({ ...valid, newPassword: candidate, confirmPassword: candidate }).success).toBe(false)
    }
  })

  test('rejeita campos extras (schema estrito)', () => {
    expect(changePasswordSchema.safeParse({ ...valid, userId: 'outro' }).success).toBe(false)
  })
})
