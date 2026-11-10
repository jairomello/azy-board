import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Ação exibida no próprio toast (ex.: "Desfazer"). */
  action?: ToastAction
  /** Tempo de exibição em ms; o padrão é 3,5s. */
  durationMs?: number
}

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error'
  action?: ToastAction
}

interface ToastContextValue {
  toast: (message: string, type?: 'success' | 'error', options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

const DEFAULT_DURATION_MS = 3500

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(0)
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer) clearTimeout(timer)
    timersRef.current.delete(id)
    setToasts(previous => previous.filter(item => item.id !== id))
  }, [])

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success', options?: ToastOptions) => {
    const id = nextIdRef.current++
    setToasts(previous => [...previous, { id, message, type, ...(options?.action ? { action: options.action } : {}) }])
    const duration = options?.durationMs ?? DEFAULT_DURATION_MS
    const timer = setTimeout(() => {
      timersRef.current.delete(id)
      setToasts(previous => previous.filter(item => item.id !== id))
    }, duration)
    timersRef.current.set(id, timer)
  }, [])

  // Sem timers órfãos após desmontar o provider.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-white shadow-lg pointer-events-auto animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action?.onClick(); dismiss(t.id) }}
                className="flex-shrink-0 rounded-md border border-white/50 px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
