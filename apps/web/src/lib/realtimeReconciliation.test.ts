import { describe, expect, test } from 'bun:test'
import { WS_REFETCH_MAX_ATTEMPTS } from '@azy-board/realtime-contracts'
import {
  advanceBarrier,
  classifySequence,
  createRefetchBarrier,
  decideBarrier,
  replayCovers,
  requiresLegacyRefetch,
} from './realtimeReconciliation'

describe('[T39] barreira de reconciliação por revisão', () => {
  test('watermark sem avanço conclui na primeira consulta', () => {
    const barrier = createRefetchBarrier('tok', 10)
    expect(decideBarrier(barrier, 10)).toBe('complete')
  })

  test('watermark desconhecido conclui (sem referência de revisão)', () => {
    const barrier = createRefetchBarrier('tok', null)
    expect(decideBarrier(barrier, 3)).toBe('complete')
  })

  test('watermark que avança pede nova tentativa', () => {
    const barrier = createRefetchBarrier('tok', 10)
    expect(decideBarrier(barrier, 11)).toBe('retry')
  })

  test('esgota após o limite de tentativas', () => {
    let barrier = createRefetchBarrier('tok', 0)
    for (let attempt = 0; attempt < WS_REFETCH_MAX_ATTEMPTS; attempt += 1) {
      barrier = advanceBarrier(barrier, barrier.watermarkBefore! + 1)
    }
    expect(barrier.attempts).toBe(WS_REFETCH_MAX_ATTEMPTS)
    expect(decideBarrier(barrier, barrier.watermarkBefore! + 1)).toBe('exhausted')
  })

  test('advanceBarrier reposiciona a referência e incrementa a tentativa', () => {
    const barrier = createRefetchBarrier('tok', 5)
    const next = advanceBarrier(barrier, 8)
    expect(next.watermarkBefore).toBe(8)
    expect(next.attempts).toBe(1)
    expect(barrier.attempts).toBe(0)
  })
})

describe('[T39] refetch obrigatório de cursor legado', () => {
  test('cliente sem protocolo com cursor exige refetch', () => {
    expect(requiresLegacyRefetch(null, 7)).toBe(true)
  })

  test('cliente novo sem cursor não exige refetch', () => {
    expect(requiresLegacyRefetch(null, null)).toBe(false)
  })

  test('protocolo suportado mantém o replay por cursor', () => {
    expect(requiresLegacyRefetch(1, 7)).toBe(false)
    expect(requiresLegacyRefetch(2, 7)).toBe(false)
  })
})

describe('[T39] cobertura de replay', () => {
  test('replay dentro do limite cobre a lacuna', () => {
    expect(replayCovers(10, null)).toBe(true)
  })

  test('qualquer motivo de resync invalida o replay', () => {
    expect(replayCovers(0, 'gap')).toBe(false)
    expect(replayCovers(0, 'overflow')).toBe(false)
    expect(replayCovers(0, 'legacy')).toBe(false)
  })
})

describe('[T39] classificação de sequência do cliente', () => {
  test('sem cursor, o primeiro evento é lacuna (aguarda reconciliação)', () => {
    expect(classifySequence(null, 1)).toBe('gap')
  })

  test('sequence já aplicada é duplicata', () => {
    expect(classifySequence(5, 5)).toBe('duplicate')
    expect(classifySequence(5, 4)).toBe('duplicate')
  })

  test('cursor+1 é contíguo', () => {
    expect(classifySequence(5, 6)).toBe('contiguous')
  })

  test('salto acima de cursor+1 é lacuna', () => {
    expect(classifySequence(5, 7)).toBe('gap')
  })
})
