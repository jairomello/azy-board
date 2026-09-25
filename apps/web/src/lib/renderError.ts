// Utilitários de erro de renderização do frontend.
// Regra central: detalhes internos (mensagem/stack) só podem ir para a UI em
// desenvolvimento e para a observabilidade; nunca para a tela em produção.

export interface RenderErrorDetails {
  showDetails: boolean
  message: string | null
  stack: string | null
}

function defaultUuidProvider(): (() => string) | null {
  const webCrypto = globalThis.crypto
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return () => webCrypto.randomUUID()
  }
  return null
}

// Gera um identificador de correlação único por ocorrência. Aceita um provedor
// injetável para permitir testar o fallback sem depender do ambiente.
export function createErrorReference(uuid: (() => string) | null = defaultUuidProvider()): string {
  if (uuid) {
    try {
      const value = uuid()
      if (value) return value
    } catch {
      // cai no fallback abaixo
    }
  }
  return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Forma curta exibida na tela, legível para o usuário informar ao suporte.
export function shortErrorReference(reference: string): string {
  return reference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
}

// Decide o que a UI pode mostrar conforme o ambiente.
export function describeRenderError(error: unknown, isProduction: boolean): RenderErrorDetails {
  if (isProduction) return { showDetails: false, message: null, stack: null }
  const normalized = error instanceof Error ? error : new Error(String(error))
  return { showDetails: true, message: normalized.message, stack: normalized.stack ?? null }
}

export interface ReportRenderErrorInput {
  reference: string | null
  error: unknown
  componentStack?: string | null
}

// Sentry é carregado dinamicamente apenas se AZYBOARD_SENTRY_DSN estiver configurado.
// O módulo @sentry/react é opcional e carregado sob demanda.
let sentryModule: Record<string, unknown> | null = null
let sentryInitialized = false

// Inicializa Sentry no frontend se AZYBOARD_SENTRY_DSN estiver configurado.
// Chamado uma vez na inicialização do app.
export async function initSentryFrontend(dsn?: string): Promise<void> {
  if (sentryInitialized || !dsn) return

  try {
    // Carregar Sentry dinamicamente - usar eval para evitar que Vite tente pré-bundlar
    const Sentry = await (new Function('return import("@sentry/react")')() as Promise<Record<string, unknown>>)
    const init = Sentry.init as ((options: Record<string, unknown>) => void) | undefined
    if (init) {
      init({
        dsn,
        beforeSend(event: Record<string, unknown>) {
          // Redact sensitive data before sending
          const req = event.request as Record<string, unknown> | undefined
          if (req) {
            delete req.cookies
            delete req.headers
          }
          return event
        },
      })
      sentryModule = Sentry
      sentryInitialized = true
    }
  } catch {
    // Sentry não disponível — continuar sem error tracking
  }
}

// Registra o erro completo apenas para observabilidade/console. Ponto único de
// extensão para um provedor de observabilidade no futuro.
export function reportRenderError({ reference, error, componentStack }: ReportRenderErrorInput): void {
  const normalized = error instanceof Error ? error : new Error(String(error))

  // Enviar para Sentry se configurado
  if (sentryModule && sentryInitialized) {
    const withScope = sentryModule.withScope as ((callback: (scope: Record<string, unknown>) => void) => void) | undefined
    const captureException = sentryModule.captureException as ((error: Error) => void) | undefined

    if (withScope && captureException) {
      withScope((scope) => {
        const setTag = scope.setTag as ((key: string, value: string) => void) | undefined
        const setExtra = scope.setExtra as ((key: string, value: unknown) => void) | undefined

        if (reference && setTag) {
          setTag('error_reference', reference)
        }
        if (componentStack && setExtra) {
          setExtra('componentStack', componentStack)
        }
        captureException(normalized)
      })
    }
  }

  console.error('[ErrorBoundary]', {
    reference,
    message: normalized.message,
    stack: normalized.stack ?? null,
    componentStack: componentStack ?? null,
  })
}
