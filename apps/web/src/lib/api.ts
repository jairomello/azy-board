const BASE = '/api'

// Timeout padrão de cada requisição HTTP do web. Pode ser sobreposto por chamada
// via `timeoutMs` nas opções.
export const DEFAULT_TIMEOUT_MS = 15_000

// Backoff entre tentativas automáticas de retry (curto, apenas 1 nova tentativa).
const RETRY_BACKOFF_MS = 150

// Métodos idempotentes: repetir não duplica efeitos colaterais.
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number
}

type AbortSignalStatics = typeof AbortSignal & {
  timeout?: (milliseconds: number) => AbortSignal
  any?: (signals: AbortSignal[]) => AbortSignal
}

const AbortSignalStatics = AbortSignal as AbortSignalStatics

// Cancelamento por AbortController é esperado e não deve virar erro de domínio
// (nem toast). O TanStack Query usa isto para não reexecutar consultas canceladas.
export function isAbortError(error: unknown): boolean {
  return Boolean(error) && typeof error === 'object' && (error as { name?: string }).name === 'AbortError'
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly details: unknown
  readonly retryable: boolean

  constructor(message: string, status: number, code?: string, details: unknown = null, retryable = false) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
    this.retryable = retryable
  }
}

function delay(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds))
}

// Combina o timeout da requisição com o sinal do chamador. O timeout usa
// `AbortSignal.timeout`/`AbortSignal.any` quando disponíveis e cai para um
// `AbortController` manual caso contrário.
function createTimeoutSignal(timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { signal: undefined as AbortSignal | undefined, didTimeout: () => false, cleanup: () => {} }
  }
  const timeout = AbortSignalStatics.timeout
  if (typeof timeout === 'function') {
    const signal = timeout(timeoutMs)
    return { signal, didTimeout: () => signal.aborted, cleanup: () => {} }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs)
  return { signal: controller.signal, didTimeout: () => controller.signal.aborted, cleanup: () => clearTimeout(timer) }
}

function combineSignals(primary?: AbortSignal | null, secondary?: AbortSignal | null): AbortSignal | undefined {
  const signals = [primary, secondary].filter((signal): signal is AbortSignal => Boolean(signal))
  if (signals.length === 0) return undefined
  if (signals.length === 1) return signals[0]
  const any = AbortSignalStatics.any
  if (typeof any === 'function') return any(signals)
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

async function executeRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options
  // FormData não pode receber Content-Type manual: o browser define o boundary.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  const timeout = createTimeoutSignal(timeoutMs)
  const signal = combineSignals(init.signal, timeout.signal)

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal,
      credentials: 'include', // Envia cookie de sessão automaticamente
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    })
  } catch (error) {
    // Timeout é erro de transporte identificável; cancelamento do chamador sobe intacto.
    if (timeout.didTimeout() && !init.signal?.aborted) {
      throw new ApiError('Tempo limite excedido ao falar com o servidor', 408, 'TIMEOUT', null, true)
    }
    if (isAbortError(error)) throw error
    throw new ApiError(error instanceof Error ? error.message : 'Falha de rede', 0, 'NETWORK_ERROR', null, true)
  } finally {
    timeout.cleanup()
  }

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
    if (error && typeof error === 'object') {
      throw new ApiError(error.message ?? `HTTP ${res.status}`, res.status, error.code, error.details, error.retryable === true)
    }
    throw new ApiError(typeof error === 'string' ? error : `HTTP ${res.status}`, res.status, body?.code)
  }

  if (res.status === 204) return undefined as T

  return res.json()
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const maxAttempts = IDEMPOTENT_METHODS.has(method) ? 2 : 1
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await executeRequest<T>(path, options)
    } catch (error) {
      // Só repete método idempotente cujo erro o servidor marcou como retryable.
      const canRetry = error instanceof ApiError && error.retryable && attempt < maxAttempts
      if (!canRetry) throw error
      await delay(RETRY_BACKOFF_MS * attempt)
    }
  }
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, options),
  post: <T>(path: string, body: unknown, options?: ApiRequestOptions) => request<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, options?: ApiRequestOptions) => request<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown, options?: ApiRequestOptions) => request<T>(path, {
    ...options,
    method: 'DELETE',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }),
  // Upload multipart (o endpoint de avatar usa PUT).
  upload: <T>(path: string, formData: FormData, options?: ApiRequestOptions) => request<T>(path, { ...options, method: 'PUT', body: formData }),
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}
