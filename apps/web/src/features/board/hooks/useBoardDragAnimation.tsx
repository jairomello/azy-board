import { createContext, useCallback, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import {
  activatorPointer,
  adjustPointerForScroll,
  pointerFromDrag,
  prefersReducedMotion,
  scrollDeltaSince,
  type DragPointer,
  type DragScrollOrigin,
} from '../model/dragAnimation'
import { emptyPreview, resolveDragPreview, type DragPreview, type PreviewColumn, type PreviewSource } from '../model/dragPreview'

/**
 * Estado do arraste de cards do quadro (`docs/board-drag-animation.md`).
 *
 * O dnd-kit segue dono do ciclo do arraste (captura do ponteiro, ativação,
 * overlay) e da persistência; a prévia é resolvida aqui, a partir do ponteiro e da
 * geometria medida no início, porque o sortable do dnd-kit não desloca itens entre
 * listas. O resultado é exposto aos componentes, que apenas desenham.
 */

/** Medição do quadro no início do arraste: colunas com cards e o card arrastado. */
export interface BoardDragMeasurement {
  columns: PreviewColumn[]
  source: PreviewSource | null
  /**
   * Containers roláveis medidos na largada. O quadro rola durante o arraste e,
   * sem reprojetar o ponteiro, a prévia miraria a coluna que estava ali antes.
   */
  scroll?: DragScrollOrigin[]
}

/** Mede as colunas e o card ativo. Fornecido pelo quadro (DOM). */
export type BoardDragMeasure = (activeId: string) => BoardDragMeasurement

export interface BoardDragAnimationValue {
  /** Prévia corrente: coluna da vaga, índice, altura e âncora da soltura. */
  preview: DragPreview
  /** Id do card arrastado, ou `null` quando não há arraste de card. */
  activeId: string | null
  /** Se um arraste está em curso. */
  dragging: boolean
  /** Se o sistema pede menos movimento. */
  reducedMotion: boolean
  /** Leitura imperativa da validade do destino, para gate da mutação. */
  validRef: MutableRefObject<boolean>
  /** Última prévia calculada, lida na soltura para resolver a âncora. */
  previewRef: MutableRefObject<DragPreview>
  onDragStart(event: DragStartEvent): void
  onDragMove(event: DragMoveEvent): void
  onDragEnd(event: DragEndEvent): void
  onDragCancel(): void
}

const REPOUSO: BoardDragMeasurement = { columns: [], source: null }

export function useBoardDragAnimation(measure: BoardDragMeasure): BoardDragAnimationValue {
  const [preview, setPreview] = useState<DragPreview>(() => emptyPreview())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [reducedMotion] = useState(() => prefersReducedMotion())

  const measureRef = useRef(measure)
  measureRef.current = measure
  const medicaoRef = useRef<BoardDragMeasurement>(REPOUSO)
  const activatorRef = useRef<DragPointer | null>(null)
  const colunaRef = useRef(false)
  const validRef = useRef(false)
  const previewRef = useRef<DragPreview>(emptyPreview())
  /** Último deslocamento do ponteiro: a rolagem sozinha também recalcula a prévia. */
  const lastDeltaRef = useRef<DragPointer | null>(null)
  const scrollCleanupRef = useRef<(() => void) | null>(null)

  /** Ponteiro atual no viewport; `null` quando o evento ativador não o informou. */
  const aplicarPreview = useCallback((proxima: DragPreview) => {
    previewRef.current = proxima
    setPreview(anterior => (
      anterior.targetId === proxima.targetId && anterior.columnId === proxima.columnId
      && anterior.index === proxima.index && anterior.height === proxima.height
        ? anterior
        : proxima
    ))
  }, [])

  const limparRolagem = useCallback(() => {
    scrollCleanupRef.current?.()
    scrollCleanupRef.current = null
  }, [])

  /**
   * Ponteiro reprojetado para as coordenadas da medição: o deslocamento do
   * arraste é somado à rolagem acumulada dos containers desde a largada.
   * Sem isso, rolar o quadro durante o arraste desalinha ponteiro e coluna.
   */
  const currentPointer = useCallback((delta: DragPointer): DragPointer | null => {
    if (!activatorRef.current) return null
    const rolagem = scrollDeltaSince(medicaoRef.current.scroll ?? [])
    return adjustPointerForScroll(pointerFromDrag(activatorRef.current, delta), rolagem)
  }, [])

  /** Resolve e aplica a prévia para um deslocamento do ponteiro. */
  const aplicarNoDeslocamento = useCallback((delta: DragPointer): DragPreview | null => {
    const pointer = currentPointer(delta)
    const source = medicaoRef.current.source
    if (!pointer || !source) return null
    const proxima = resolveDragPreview(pointer, source, medicaoRef.current.columns)
    validRef.current = proxima.targetId !== null
    aplicarPreview(proxima)
    return proxima
  }, [aplicarPreview, currentPointer])

  const onDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id.toString()
    // Arrastar coluna não passa pela prévia: a coluna é o próprio destino.
    colunaRef.current = activeId.includes(':col:')
    activatorRef.current = activatorPointer(event.activatorEvent)
    validRef.current = false
    lastDeltaRef.current = null
    limparRolagem()
    setDragging(true)
    if (colunaRef.current) {
      medicaoRef.current = REPOUSO
      setActiveId(null)
      aplicarPreview(emptyPreview())
      return
    }
    const medicao = measureRef.current(activeId)
    medicaoRef.current = medicao
    setActiveId(medicao.source ? activeId : null)
    aplicarPreview(medicao.source
      ? resolveDragPreview(activatorRef.current ?? { x: 0, y: 0 }, medicao.source, medicao.columns)
      : emptyPreview())
    // Auto-scroll do dnd-kit e rolagem manual movem as colunas sem emitir
    // DragMove: ouvir os containers mantém a prévia no conteúdo sob o ponteiro.
    const rolagem = medicao.scroll ?? []
    if (rolagem.length > 0) {
      const aoRolar = () => {
        if (lastDeltaRef.current) aplicarNoDeslocamento(lastDeltaRef.current)
      }
      for (const origin of rolagem) origin.element.addEventListener('scroll', aoRolar, { passive: true })
      scrollCleanupRef.current = () => {
        for (const origin of rolagem) origin.element.removeEventListener('scroll', aoRolar)
      }
    }
  }, [aplicarPreview, aplicarNoDeslocamento, limparRolagem])

  const onDragMove = useCallback((event: DragMoveEvent) => {
    if (colunaRef.current) return
    lastDeltaRef.current = event.delta
    aplicarNoDeslocamento(event.delta)
  }, [aplicarNoDeslocamento])

  const onDragEnd = useCallback((event: DragEndEvent) => {
    if (!colunaRef.current) {
      lastDeltaRef.current = event.delta
      aplicarNoDeslocamento(event.delta)
    }
    limparRolagem()
    medicaoRef.current = REPOUSO
    activatorRef.current = null
    colunaRef.current = false
    lastDeltaRef.current = null
    setActiveId(null)
    setDragging(false)
    aplicarPreview(emptyPreview())
  }, [aplicarNoDeslocamento, aplicarPreview, limparRolagem])

  const onDragCancel = useCallback(() => {
    validRef.current = false
    limparRolagem()
    medicaoRef.current = REPOUSO
    activatorRef.current = null
    colunaRef.current = false
    lastDeltaRef.current = null
    setActiveId(null)
    setDragging(false)
    aplicarPreview(emptyPreview())
  }, [aplicarPreview, limparRolagem])

  return useMemo(() => ({
    preview,
    activeId,
    dragging,
    reducedMotion,
    validRef,
    previewRef,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
  }), [preview, activeId, dragging, reducedMotion, onDragStart, onDragMove, onDragEnd, onDragCancel])
}

const BoardDragAnimationContext = createContext<BoardDragAnimationValue | null>(null)

/** Entrega o estado do arraste aos cards sem propagar props por lane e coluna. */
export function BoardDragAnimationProvider({ value, children }: { value: BoardDragAnimationValue; children: ReactNode }) {
  return <BoardDragAnimationContext.Provider value={value}>{children}</BoardDragAnimationContext.Provider>
}

/** Estado do arraste para o quadro; `null` fora de um quadro instrumentado. */
export function useBoardDragAnimationValue(): BoardDragAnimationValue | null {
  return useContext(BoardDragAnimationContext)
}
