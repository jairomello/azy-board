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

// Registra o erro completo apenas para observabilidade/console. Ponto único de
// extensão para um provedor de observabilidade no futuro.
export function reportRenderError({ reference, error, componentStack }: ReportRenderErrorInput): void {
  const normalized = error instanceof Error ? error : new Error(String(error))
  console.error('[ErrorBoundary]', {
    reference,
    message: normalized.message,
    stack: normalized.stack ?? null,
    componentStack: componentStack ?? null,
  })
}
