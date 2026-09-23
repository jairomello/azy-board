import { QueryClient } from '@tanstack/react-query'
import { ApiError, isAbortError } from './api'

// Política única de validade/revalidação do estado remoto do web.
// Ajuste consciente: mantém dados frescos sem refazer requisições a cada foco.
// O cliente HTTP já aplica retry governado por `retryable` em métodos idempotentes,
// então aqui não repetimos `ApiError` (evita tentativa duplicada) nem cancelamentos.
// Erros inesperados não-ApiError ainda ganham uma nova chance.
export const queryDefaults = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: (failureCount: number, error: unknown) => !isAbortError(error) && !(error instanceof ApiError) && failureCount < 1,
  refetchOnWindowFocus: false,
} as const

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...queryDefaults,
    },
  },
})
