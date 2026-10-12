// Ponto único de leitura da versão do build no frontend (Card T60).
// `__APP_VERSION__`/`__BUILD_DATE__` são embutidos pelo Vite (vite.config.ts);
// em dev/testes caem para 'dev'/vazio.
declare const __APP_VERSION__: string | undefined
declare const __BUILD_DATE__: string | undefined

export interface BuildInfo {
  version: string
  buildDate: string
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
