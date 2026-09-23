// Política única de mutação otimista do board: captura um snapshot antes de
// aplicar o estado otimista e restaura esse snapshot quando a requisição falha,
// sempre comunicando o erro. Mutations reconciliadas não usam este helper: elas
// só aplicam o estado após a resposta de sucesso.
export interface OptimisticMutationOptions<S> {
  capture: () => S
  apply: () => void
  restore: (snapshot: S) => void
  request: () => Promise<unknown>
  onError: (error: unknown) => void
}

export async function runOptimisticMutation<S>(options: OptimisticMutationOptions<S>): Promise<boolean> {
  const snapshot = options.capture()
  options.apply()
  try {
    await options.request()
    return true
  } catch (error) {
    options.restore(snapshot)
    options.onError(error)
    return false
  }
}
