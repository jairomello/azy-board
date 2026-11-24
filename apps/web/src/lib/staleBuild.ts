// Recuperação de aba aberta em um build que já foi substituído no servidor.
//
// Um deploy troca os arquivos com hash de conteúdo. A aba que estava aberta
// continua pedindo os chunks antigos; quando eles não existem mais, o import
// dinâmico falha. `React.lazy` memoriza a promise rejeitada, então limpar o
// estado do ErrorBoundary não reimporta o chunk — a única saída é recarregar o
// documento.
//
// A trava de repetição evita laço de recarga quando a falha persiste (build
// quebrado no servidor): uma tentativa por carregamento e uma por janela de
// recuperação registrada em `sessionStorage`.

const RELOAD_KEY = 'azyboard:stale-build-reload'
const RELOAD_WINDOW_MS = 20_000

// Mensagens equivalentes nos três motores: Chromium ("Failed to fetch
// dynamically imported module"), Firefox ("error loading dynamically imported
// module"/"Importing a module script failed"), Safari ("Importing a module
// script failed") e o legado de bundlers ("Loading chunk 12 failed").
const STALE_BUILD_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /dynamically imported module/i,
  /loading chunk \S+ failed/i,
  /unable to preload css/i,
]

/** Uma única recarga por carregamento, mesmo sem storage disponível. */
let reloadedThisLoad = false

/** Mensagens de falha de chunk que indicam build substituído. */
export function isStaleBuildError(error: unknown): boolean {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  return STALE_BUILD_PATTERNS.some(pattern => pattern.test(message))
}

function safeSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    // Storage bloqueado (modo restrito/iframe): cai na flag de módulo.
    return null
  }
}

/** Zera a flag de módulo; usado apenas em testes. */
export function resetStaleBuildReloadForTests(): void {
  reloadedThisLoad = false
}

/**
 * Reserva a recarga automática. Retorna `false` quando já houve tentativa neste
 * carregamento ou dentro da janela de recuperação, para o chamador mostrar a
 * mensagem de build desatualizado em vez de recarregar em loop.
 */
export function claimStaleBuildReload(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeSessionStorage(),
  now: number = Date.now(),
): boolean {
  if (reloadedThisLoad) return false
  reloadedThisLoad = true

  try {
    const previous = Number(storage?.getItem(RELOAD_KEY) ?? 0)
    if (Number.isFinite(previous) && previous > 0 && now - previous < RELOAD_WINDOW_MS) return false
    storage?.setItem(RELOAD_KEY, String(now))
  } catch {
    // Sem storage, a flag de módulo já limita a uma tentativa por carregamento.
  }
  return true
}

/** Recarrega o documento se a trava permitir; retorna se a recarga foi feita. */
export function reloadForStaleBuild(
  location: { reload: () => void } = globalThis.location,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeSessionStorage(),
  now: number = Date.now(),
): boolean {
  if (!claimStaleBuildReload(storage, now)) return false
  location.reload()
  return true
}

/**
 * Instala o tratamento de `vite:preloadError`, emitido quando o pré-carregamento
 * de um chunk/CSS falha antes de o import dinâmico rejeitar.
 */
export function installStaleBuildRecovery(
  target: Pick<Window, 'addEventListener'> = globalThis.window,
  reload: () => boolean = reloadForStaleBuild,
): void {
  target.addEventListener('vite:preloadError', (event: Event) => {
    event.preventDefault()
    reload()
  })
}
