import { describe, expect, test } from 'bun:test'
import {
  CARD_REORDER_TRANSITION,
  DROP_REVERT_MS,
  DROP_SETTLE_MS,
  REDUCED_MOTION_MS,
  activatorPointer,
  dropDuration,
  planDropAnimation,
  pointerFromDrag,
  prefersReducedMotion,
  resolveDragTarget,
  toTranslateKeyframe,
  type DragTarget,
} from './model/dragAnimation'

const targets: DragTarget[] = [
  { id: 'lane-1:drop:todo', rect: { left: 100, right: 392, top: 200, bottom: 800 } },
  { id: 'lane-1:drop:doing', rect: { left: 400, right: 692, top: 200, bottom: 800 } },
]

describe('contrato da animação de arraste', () => {
  test('resolve o destino sob o ponteiro e ignora o que está fora', () => {
    expect(resolveDragTarget({ x: 200, y: 400 }, targets)).toBe('lane-1:drop:todo')
    expect(resolveDragTarget({ x: 600, y: 400 }, targets)).toBe('lane-1:drop:doing')
    expect(resolveDragTarget({ x: 396, y: 400 }, targets)).toBeNull()
    expect(resolveDragTarget({ x: 200, y: 120 }, targets)).toBeNull()
    expect(resolveDragTarget({ x: 200, y: 900 }, targets)).toBeNull()
  })

  test('trata as bordas do retângulo como dentro do destino', () => {
    expect(resolveDragTarget({ x: 100, y: 200 }, targets)).toBe('lane-1:drop:todo')
    expect(resolveDragTarget({ x: 392, y: 800 }, targets)).toBe('lane-1:drop:todo')
    expect(resolveDragTarget({ x: 99, y: 400 }, targets)).toBeNull()
    expect(resolveDragTarget({ x: 393, y: 400 }, targets)).toBeNull()
  })

  test('devolve null quando o quadro não tem destino algum', () => {
    expect(resolveDragTarget({ x: 10, y: 10 }, [])).toBeNull()
  })

  test('mantém a ordem recebida quando dois destinos se sobrepõem', () => {
    const overlapping: DragTarget[] = [
      { id: 'primeiro', rect: { left: 0, right: 100, top: 0, bottom: 100 } },
      { id: 'segundo', rect: { left: 0, right: 100, top: 0, bottom: 100 } },
    ]
    expect(resolveDragTarget({ x: 50, y: 50 }, overlapping)).toBe('primeiro')
  })

  test('escolhe a duração do assentamento pela validade e pelo movimento reduzido', () => {
    expect(dropDuration(true, false)).toBe(DROP_SETTLE_MS)
    expect(dropDuration(false, false)).toBe(DROP_REVERT_MS)
    expect(dropDuration(true, true)).toBe(REDUCED_MOTION_MS)
    expect(dropDuration(false, true)).toBe(REDUCED_MOTION_MS)
    expect(DROP_SETTLE_MS).toBeLessThan(DROP_REVERT_MS)
  })

  test('entrega a curva e a duração únicas da reordenação', () => {
    expect(CARD_REORDER_TRANSITION).toEqual({ duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' })
  })

  test('reconstrói o ponteiro do evento ativador somado ao deslocamento', () => {
    expect(pointerFromDrag({ x: 300, y: 500 }, { x: 40, y: -25 })).toEqual({ x: 340, y: 475 })
    expect(activatorPointer({ clientX: 12, clientY: 34 })).toEqual({ x: 12, y: 34 })
    expect(activatorPointer(null)).toBeNull()
    expect(activatorPointer({})).toBeNull()
    expect(activatorPointer('pointerdown')).toBeNull()
  })

  test('não assume movimento reduzido quando a media query não existe', () => {
    expect(prefersReducedMotion()).toBe(false)
  })

  test('monta o plano do assentamento sem escala residual', () => {
    const aceite = planDropAnimation({ destinoValido: true, movimentoReduzido: false })
    expect(aceite.duration).toBe(DROP_SETTLE_MS)
    expect(aceite.easing).toBe('cubic-bezier(.2,.8,.2,1)')
    expect(aceite.keyframes({ x: 10, y: 20 }, { x: -30, y: 15 })).toEqual([
      { transform: 'translate3d(10px, 20px, 0)' },
      { transform: 'translate3d(-30px, 15px, 0)' },
    ])

    const rejeicao = planDropAnimation({ destinoValido: false, movimentoReduzido: false })
    expect(rejeicao.duration).toBe(DROP_REVERT_MS)

    const reduzido = planDropAnimation({ destinoValido: true, movimentoReduzido: true })
    expect(reduzido.duration).toBe(0)
  })

  test('o keyframe final não carrega rotação nem escala', () => {
    expect(toTranslateKeyframe({ x: 0, y: 0 })).toEqual({ transform: 'translate3d(0px, 0px, 0)' })
    expect(toTranslateKeyframe({ x: 5, y: 5 }).transform).not.toContain('scale')
    expect(toTranslateKeyframe({ x: 5, y: 5 }).transform).not.toContain('rotate')
  })
})
