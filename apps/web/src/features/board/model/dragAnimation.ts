/**
 * Contrato da animação de arraste de cards do quadro (`docs/board-drag-animation.md`).
 *
 * O dnd-kit continua sendo a fonte de colisão, prévia de ordem e persistência; este
 * módulo concentra as decisões puras de movimento: qual destino está sob o ponteiro,
 * quanto dura o assentamento e qual curva a reordenação usa. Ficar aqui — e não nos
 * componentes — deixa o comportamento testável sem jsdom de animação.
 */

/** Ponto no viewport, nas mesmas coordenadas de `PointerEvent.clientX/clientY`. */
export interface DragPointer {
  x: number
  y: number
}

/** Retângulo de viewport de um destino de soltura. */
export interface DragTargetRect {
  left: number
  right: number
  top: number
  bottom: number
}

/** Destino de soltura: identificador do elemento medido e seu retângulo. */
export interface DragTarget {
  id: string
  rect: DragTargetRect
}

/** Deslocamento do arraste, equivalente a `DragMoveEvent.delta`. */
export interface DragDelta {
  x: number
  y: number
}

/** Movimento reduzido: nem o deslizamento nem o assentamento animam. */
export const REDUCED_MOTION_MS = 0

/** Duração do assentamento do card arrastado no destino válido. */
export const DROP_SETTLE_MS = 180

/** Duração da reversão quando não há destino válido sob o ponteiro. */
export const DROP_REVERT_MS = 220

/** Curva e duração do deslizamento dos demais cards durante o arraste. */
export const CARD_REORDER_TRANSITION = { duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' } as const

/** Consulta de sistema que sinaliza preferência por menos movimento. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Destino cujo retângulo contém o ponteiro, ou `null` quando ele está fora de
 * todos. As bordas contam como dentro: soltar exatamente no limite da coluna
 * entrega o card àquela coluna.
 */
export function resolveDragTarget(pointer: DragPointer, targets: readonly DragTarget[]): string | null {
  for (const target of targets) {
    const { left, right, top, bottom } = target.rect
    if (pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom) return target.id
  }
  return null
}

/** Duração do assentamento do overlay conforme a validade do destino e o movimento reduzido. */
export function dropDuration(destinoValido: boolean, movimentoReduzido: boolean): number {
  if (movimentoReduzido) return REDUCED_MOTION_MS
  return destinoValido ? DROP_SETTLE_MS : DROP_REVERT_MS
}

/** Ponteiro atual reconstruído do evento ativador somado ao deslocamento do arraste. */
export function pointerFromDrag(activator: DragPointer, delta: DragDelta): DragPointer {
  return { x: activator.x + delta.x, y: activator.y + delta.y }
}

/** Ponto do evento ativador (`pointerdown`), quando o evento tiver coordenadas. */
export function activatorPointer(event: unknown): DragPointer | null {
  if (!event || typeof event !== 'object') return null
  const { clientX, clientY } = event as { clientX?: unknown; clientY?: unknown }
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return null
  return { x: clientX, y: clientY }
}

/** Movimento reduzido do sistema, quando a media query estiver disponível. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Classe aplicada ao overlay enquanto ele assenta no destino. */
export const DRAG_OVERLAY_SETTLING_CLASS = 'board-drag-overlay--settling'

/** Variável CSS com a duração do assentamento, para o wrapper do card acompanhar. */
export const DRAG_OVERLAY_DURATION_VAR = '--board-drop-duration'

/** Keyframe do assentamento: só translação, sem escala nem rotação residuais. */
export function toTranslateKeyframe(transform: DragDelta): Keyframe {
  return { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
}

export interface DropAnimationOptions {
  /** Se havia destino válido sob o ponteiro no momento da soltura. */
  destinoValido: boolean
  /** Se o sistema pede menos movimento. */
  movimentoReduzido: boolean
}

/**
 * Plano do assentamento do `DragOverlay`, sem depender do dnd-kit para ser
 * testável. O primeiro keyframe parte da posição atual do overlay e o último
 * termina em translação pura: a rotação e a escala do wrapper do card são
 * zeradas pelo CSS, com a mesma duração publicada em `--board-drop-duration`.
 */
export interface DropAnimationPlan {
  duration: number
  easing: string
  /** Keyframes de início e fim do assentamento, em coordenadas de tela. */
  keyframes(initial: DragDelta, final: DragDelta): Keyframe[]
}

export function planDropAnimation({ destinoValido, movimentoReduzido }: DropAnimationOptions): DropAnimationPlan {
  const duration = dropDuration(destinoValido, movimentoReduzido)
  return {
    duration,
    easing: CARD_REORDER_TRANSITION.easing,
    keyframes: (initial, final) => [toTranslateKeyframe(initial), toTranslateKeyframe(final)],
  }
}
