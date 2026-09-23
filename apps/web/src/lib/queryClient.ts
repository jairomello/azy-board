import { QueryClient } from '@tanstack/react-query'
import { isAbortError } from './api'

// Política única de validade/revalidação do estado remoto do web.
// Ajuste consciente: mantém dados frescos sem refazer requisições a cada foco.
export const queryDefaults = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: (failureCount: number, error: unknown) => !isAbortError(error) && failureCount < 1,
  refetchOnWindowFocus: false,
} as const

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...queryDefaults,
    },
  },
})
