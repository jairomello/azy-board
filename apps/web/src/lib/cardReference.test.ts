import { describe, expect, test } from 'bun:test'
import { formatCardReference } from './cardReference'

describe('formatCardReference', () => {
  test('usa sequenceCode, título completo e uuid entre aspas', () => {
    expect(formatCardReference({
      id: '9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
      title: 'Opcionalmente tarefas do checklist com data',
      sequenceCode: 'T5',
    })).toBe("'T5 - Opcionalmente tarefas do checklist com data [id=9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f]'")
  })

  test('sem sequenceCode, traz apenas o título e o uuid', () => {
    expect(formatCardReference({
      id: 'e067830d-1111-2222-3333-444455556666',
      title: 'Sem código',
      sequenceCode: null,
    })).toBe("'Sem código [id=e067830d-1111-2222-3333-444455556666]'")
  })

  test('ignora sequenceCode em branco', () => {
    expect(formatCardReference({
      id: 'abcdefgh-1111-2222-3333-444455556666',
      title: 'X',
      sequenceCode: '   ',
    })).toBe("'X [id=abcdefgh-1111-2222-3333-444455556666]'")
  })
})
