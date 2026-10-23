import { useEffect } from 'react'

// Card T87 — enquanto o lightbox está aberto, o ESC fecha só ele.
//
// A modal do card escuta ESC em `window` na fase de bolha. Esta guarda roda na
// fase de captura, interrompe a propagação e fecha o lightbox por conta própria
// (mesmo padrão do editor expandido), para que fechar a imagem não feche o card
// junto — sem depender de como o lightbox trata ESC internamente.
export function useLightboxEscapeGuard(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, close])
}
