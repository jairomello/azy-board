import { useLayoutEffect, useRef, type RefObject } from 'react'

interface CardFlipOptions {
  /** Liga o deslizamento (arraste em curso e movimento permitido). */
  enabled: boolean
  duration: number
  easing: string
}

/**
 * Deslizamento dos cards quando a prévia muda.
 *
 * A cada commit o hook mede os cards do quadro e anima, a partir de onde estavam,
 * os que mudaram de posição. Uma animação nova cancela a anterior do mesmo card, e
 * é por isso que cruzar pontos médios em sequência continua de onde o card está, em
 * vez de enfileirar. É o mesmo mecanismo do protótipo, com a Web Animations API.
 */
export function useCardFlip(containerRef: RefObject<HTMLElement | null>, { enabled, duration, easing }: CardFlipOptions) {
  const anteriores = useRef(new Map<Element, DOMRect>())
  const animacoes = useRef(new WeakMap<Element, Animation>())

  useLayoutEffect(() => {
    const container = containerRef.current
    const cards = container ? Array.from(container.querySelectorAll<HTMLElement>('.kanban-card')) : []
    const atuais = new Map<Element, DOMRect>(cards.map(card => [card, card.getBoundingClientRect()]))

    if (enabled && duration > 0) {
      for (const [card, anterior] of anteriores.current) {
        const atual = atuais.get(card)
        if (!atual) continue
        const dx = anterior.left - atual.left
        const dy = anterior.top - atual.top
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
        animacoes.current.get(card)?.cancel()
        const animation = card.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
          { duration, easing },
        )
        animacoes.current.set(card, animation)
      }
    }

    anteriores.current = atuais
  })

  // Ao encerrar o arraste as posições de referência são descartadas: o próximo
  // arraste começa a medir do zero, sem animar o reflow da soltura.
  useLayoutEffect(() => {
    if (enabled) return
    anteriores.current = new Map()
  }, [enabled])
}
