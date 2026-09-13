const BASE = '/api'

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
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include', // Envia cookie de sessão automaticamente
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}
