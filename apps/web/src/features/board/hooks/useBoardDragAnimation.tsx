import { createContext, useCallback, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { activatorPointer, pointerFromDrag, prefersReducedMotion, type DragPointer } from '../model/dragAnimation'
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

  const currentPointer = useCallback((delta: { x: number; y: number }): DragPointer | null => (
    activatorRef.current ? pointerFromDrag(activatorRef.current, delta) : null
  ), [])

  const onDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id.toString()
    // Arrastar coluna não passa pela prévia: a coluna é o próprio destino.
    colunaRef.current = activeId.includes(':col:')
    activatorRef.current = activatorPointer(event.activatorEvent)
    validRef.current = false
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
  }, [aplicarPreview])

  const onDragMove = useCallback((event: DragMoveEvent) => {
    if (colunaRef.current) return
    const pointer = currentPointer(event.delta)
    const source = medicaoRef.current.source
    if (!pointer || !source) return
    const proxima = resolveDragPreview(pointer, source, medicaoRef.current.columns)
    validRef.current = proxima.targetId !== null
    aplicarPreview(proxima)
  }, [aplicarPreview, currentPointer])

  const onDragEnd = useCallback((event: DragEndEvent) => {
    if (!colunaRef.current) {
      const pointer = currentPointer(event.delta)
      const source = medicaoRef.current.source
      validRef.current = Boolean(pointer && source && resolveDragPreview(pointer, source, medicaoRef.current.columns).targetId)
    }
    medicaoRef.current = REPOUSO
    activatorRef.current = null
    colunaRef.current = false
    setActiveId(null)
    setDragging(false)
    aplicarPreview(emptyPreview())
  }, [aplicarPreview, currentPointer])

  const onDragCancel = useCallback(() => {
    validRef.current = false
    medicaoRef.current = REPOUSO
    activatorRef.current = null
    colunaRef.current = false
    setActiveId(null)
    setDragging(false)
    aplicarPreview(emptyPreview())
  }, [aplicarPreview])

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
