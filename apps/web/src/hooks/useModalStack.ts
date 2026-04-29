import { useState, useCallback } from 'react'

const MAX_STACK_DEPTH = 5

export function useModalStack() {
  const [stack, setStack] = useState<string[]>([])

  const push = useCallback((itemId: string) => {
    setStack(prev => {
      if (prev.length >= MAX_STACK_DEPTH) {
        // Tarefa 6.3 — substituir o topo ao atingir o limite
        return [...prev.slice(0, -1), itemId]
      }
      return [...prev, itemId]
    })
  }, [])

  // Tarefa 6.2 — pop remove apenas o topo (usado pelo Escape e ← Voltar)
  const pop = useCallback(() => {
    setStack(prev => prev.slice(0, -1))
  }, [])

  // closeAll limpa toda a pilha (usado pelo ✕ Fechar)
  const closeAll = useCallback(() => {
    setStack([])
  }, [])

  return { stack, push, pop, closeAll }
}
