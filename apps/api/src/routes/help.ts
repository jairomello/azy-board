// Central de ajuda: entrega o manual funcional versionado (`docs/azyboard-wiki`).
//
// Endpoint autenticado e privado, no mesmo padrão de `routes/skills.ts`: o
// conteúdo nunca é servido como asset estático público, e as respostas não são
// cacheáveis por intermediários. O escopo exposto (módulos, capa e exclusões) é
// definido em um único ponto: `services/helpContent.ts`.
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware } from '../middleware/auth'
import { findHelpPage, loadHelpContent } from '../services/helpContent'

export const helpRouter = new Hono<HonoEnv>()

helpRouter.use('*', authMiddleware)

// [SECURITY] Documentação de produto é igual para todos os tenants: não há
// filtro por tenant, mas o conteúdo exige sessão autenticada e nunca é público.
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

function unavailable(c: Context<HonoEnv>) {
  return c.json({
    error: 'A documentação do produto não está disponível nesta instalação',
    code: 'HELP_UNAVAILABLE',
    retryable: false,
  }, 500, PRIVATE_HEADERS)
}

helpRouter.get('/index', async (c) => {
  const result = await loadHelpContent()
  if (!result.ok) return unavailable(c)
  const { version, home, modules } = result.content.index
  return c.json({ version, home, modules }, 200, PRIVATE_HEADERS)
})

helpRouter.get('/pages/:slug', async (c) => {
  const result = await loadHelpContent()
  if (!result.ok) return unavailable(c)
  const page = findHelpPage(result.content, c.req.param('slug'))
  if (!page) {
    return c.json({
      error: 'Página de ajuda não encontrada',
      code: 'HELP_PAGE_NOT_FOUND',
      retryable: false,
    }, 404, PRIVATE_HEADERS)
  }
  return c.json({
    version: result.content.index.version,
    slug: page.slug,
    title: page.title,
    order: page.order,
    path: page.path,
    moduleId: page.moduleId,
    moduleTitle: page.moduleTitle,
    sha256: page.sha256,
    markdown: page.markdown,
  }, 200, PRIVATE_HEADERS)
})
