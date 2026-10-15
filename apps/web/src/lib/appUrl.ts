// Base path do deploy (ex.: `/azyboard`). Fonte única para quem precisa
// prefixar caminhos absolutos fora do fluxo de `fetch` interceptado.
export function appBasePath(): string {
  return ((window as { __BASE_PATH__?: string }).__BASE_PATH__ || '').replace(/\/+$/, '')
}

// Resolve URLs servidas pela API quando a aplicação roda sob um base path
// (deploy path-based, ex.: /azyboard/). O interceptor de `fetch` em main.tsx só
// cobre chamadas feitas por fetch; tags <img> precisam deste resolvedor.
export function resolveAppUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url

  const basePath = appBasePath()
  if (basePath && url.startsWith('/api/')) return `${basePath}${url}`
  return url
}
