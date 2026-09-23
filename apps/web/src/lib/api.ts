const BASE = '/api'

// Cancelamento por AbortController é esperado e não deve virar erro de domínio
// (nem toast). O TanStack Query usa isto para não reexecutar consultas canceladas.
export function isAbortError(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { name?: string }).name === 'AbortError'
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly details: unknown

  constructor(message: string, status: number, code?: string, details: unknown = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // FormData não pode receber Content-Type manual: o browser define o boundary.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  // `options.signal` (quando presente) cancela a requisição; o AbortError sobe
  // intacto para a camada de cache tratar como cancelamento.
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include', // Envia cookie de sessão automaticamente
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })

  if (res.status === 401 && path !== '/auth/me') {
    // Redirecionar para login quando sessão expirar.
    // Em deploy path-based (ex.: /azyboard/), o href usa window.__BASE_PATH__
    // (injetado pelo proxy) e o pathname e normalizado para ser relativo ao
    // base, para que o navigate(redirect) do React Router resolva correto.
    const BASE_PATH = ((window as any).__BASE_PATH__ || '').replace(/\/+$/, '')
    let currentPath = window.location.pathname
    if (BASE_PATH && currentPath.startsWith(BASE_PATH)) {
      currentPath = currentPath.slice(BASE_PATH.length) || '/'
    }
    window.location.href = `${BASE_PATH}/login?redirect=${encodeURIComponent(currentPath)}`
    throw new Error('Sessão expirada')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string | { code?: string; message?: string; details?: unknown; retryable?: boolean }; code?: string } | null
    const error = body?.error
    if (error && typeof error === 'object') throw new ApiError(error.message ?? `HTTP ${res.status}`, res.status, error.code, error.details)
    throw new ApiError(typeof error === 'string' ? error : `HTTP ${res.status}`, res.status, body?.code)
  }

  if (res.status === 204) return undefined as T

  return res.json()
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, body: unknown, options?: RequestInit) => request<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, options?: RequestInit) => request<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, options?: RequestInit) => request<T>(path, { ...options, method: 'DELETE' }),
  // Upload multipart (o endpoint de avatar usa PUT).
  upload: <T>(path: string, formData: FormData, options?: RequestInit) => request<T>(path, { ...options, method: 'PUT', body: formData }),
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}
