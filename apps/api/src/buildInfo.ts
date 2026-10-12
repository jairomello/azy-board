// Resolve a versão do build do lado da API (Card T60).
// Prioridade: env do build → arquivo .build-info.json (gerado por
// `bun run build:version` e embarcado na imagem) → 'dev'.
export interface ApiBuildInfo {
  version: string
  buildDate: string
}

let cached: ApiBuildInfo | null = null

export async function resolveApiBuildInfo(): Promise<ApiBuildInfo> {
  if (cached) return cached

  const envVersion = process.env.AZYBOARD_BUILD_VERSION?.trim()
  if (envVersion) {
    cached = { version: envVersion, buildDate: process.env.AZYBOARD_BUILD_DATE?.trim() ?? '' }
    return cached
  }

  // O cwd varia: raiz do repo em dev, /app na imagem, apps/api no runner local.
  for (const candidate of ['.build-info.json', '../../.build-info.json', '../.build-info.json']) {
    try {
      const file = Bun.file(candidate)
      if (!(await file.exists())) continue
      const parsed = await file.json() as { version?: unknown; buildDate?: unknown }
      if (typeof parsed.version === 'string' && parsed.version) {
        cached = { version: parsed.version, buildDate: typeof parsed.buildDate === 'string' ? parsed.buildDate : '' }
        return cached
      }
    } catch {
      // Arquivo ausente/ inválido: tenta o próximo candidato.
    }
  }

  cached = { version: 'dev', buildDate: '' }
  return cached
}

/** Somente para testes: limpa o memo entre casos. */
export function resetApiBuildInfoCache(): void {
  cached = null
}
