const BASE = '/api'

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
      currentPath = currentPath.slice(BASE_PATH.length - 1) // mantém "/" inicial
    }
    window.location.href = `${BASE_PATH}login?redirect=${encodeURIComponent(currentPath)}`
    throw new Error('Sessão expirada')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(body.error ?? `HTTP ${res.status}`)
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
