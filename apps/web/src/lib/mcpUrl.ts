// Resolve a URL pública do MCP remoto (rota `/mcp`, servida no mesmo host da web).
// Deriva da origem atual + base path injetado pelo proxy (`window.__BASE_PATH__`,
// normalizado sem barra final), valendo tanto na raiz quanto em publicação sob
// subpath (ex.: `/azyboard/mcp`). Sem `window` (testes/SSR) devolve o caminho
// relativo `/mcp`, que permanece um valor seguro para exibição.
type McpUrlWindow = { location?: { origin?: string }; __BASE_PATH__?: string }

function currentWindow(): McpUrlWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as McpUrlWindow)
}

export function resolveMcpUrl(): string {
  const win = currentWindow()
  const basePath = (win?.__BASE_PATH__ ?? '').replace(/\/+$/, '')
  const origin = win?.location?.origin ?? ''
  return `${origin}${basePath}/mcp`
}
