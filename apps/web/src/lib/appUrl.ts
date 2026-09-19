// Resolve URLs servidas pela API quando a aplicação roda sob um base path
// (deploy path-based, ex.: /azyboard/). O interceptor de `fetch` em main.tsx só
// cobre chamadas feitas por fetch; tags <img> precisam deste resolvedor.
export function resolveAppUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url

  const basePath = ((window as any).__BASE_PATH__ || '').replace(/\/+$/, '')
  if (basePath && url.startsWith('/api/')) return `${basePath}${url}`
  return url
}
