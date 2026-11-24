// Ponto único de leitura da versão do build no frontend (Card T60).
// `__APP_VERSION__`/`__BUILD_DATE__` são embutidos pelo Vite (vite.config.ts);
// em dev/testes caem para 'dev'/vazio.
import { api } from './api'

declare const __APP_VERSION__: string | undefined
declare const __BUILD_DATE__: string | undefined

export interface BuildInfo {
  version: string
  buildDate: string
}

/** Resposta da rota pública `/version` (e `/api/version`). */
export interface PublishedBuildInfo {
  version: string
  buildDate?: string
}

/** Normaliza os valores embutidos no bundle (exposto para teste). */
export function pickBuildInfo(appVersion: unknown, buildDate: unknown): BuildInfo {
  return {
    version: typeof appVersion === 'string' && appVersion ? appVersion : 'dev',
    buildDate: typeof buildDate === 'string' ? buildDate : '',
  }
}

export function getBuildInfo(): BuildInfo {
  return pickBuildInfo(
    typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined,
    typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : undefined,
  )
}

/**
 * Indica se o build publicado difere do bundle em uso. Comparação por
 * diferença de string: qualquer versão diferente já significa documento
 * desatualizado. Build de desenvolvimento (`dev`) nunca sinaliza atualização.
 */
export function isUpdateAvailable(currentVersion: string, publishedVersion: string | null | undefined): boolean {
  if (!publishedVersion || currentVersion === 'dev' || publishedVersion === 'dev') return false
  return publishedVersion !== currentVersion
}

/**
 * Consulta a versão publicada. `cache: 'no-store'` evita que o navegador sirva
 * uma resposta antiga e esconda um deploy. Erros sobem para o chamador decidir
 * (o watcher ignora e tenta de novo no próximo ciclo).
 */
export async function fetchPublishedBuildInfo(options: { signal?: AbortSignal } = {}): Promise<PublishedBuildInfo | null> {
  const info = await api.get<PublishedBuildInfo>('/version', {
    cache: 'no-store',
    timeoutMs: 8_000,
    ...(options.signal ? { signal: options.signal } : {}),
  })
  return info && typeof info.version === 'string' && info.version ? info : null
}
