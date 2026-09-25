import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateApiKey } from '../services/auth'
import type { RequestContext } from '@azy-board/api-contracts'
import { API_KEY_PERMISSIONS } from '../services/authorization'
import { parseJson, projectApiKeySchema, userApiKeySchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'

export const apiKeysRouter = new Hono<HonoEnv>()
apiKeysRouter.use('*', authMiddleware)


// POST /projects/:projectId/api-keys — gerar nova API Key (rota legada, mantida por compatibilidade)
apiKeysRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const parsed = await parseJson(c, projectApiKeySchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { key } = generateApiKey()
  const keyHash = await hashKey(key)
  const created = await persistence.apiKeys.create(userPersistenceContext(ctx), {
    ownerId: ctx.userId, name: body.name, keyHash, aiModelName: body.aiModelName,
    projectScope: JSON.stringify([c.req.param('projectId')]),
    permissionScope: body.permissionScope ? JSON.stringify(body.permissionScope) : null,
    expiresAt: body.expiresAt ?? null,
  })

  // Retorna o valor completo apenas nesta resposta — não é possível recuperá-lo depois
  return c.json({ id: created.id, key, name: body.name }, 201)
})

// GET /projects/:projectId/api-keys — listar chaves (rota legada, mantida por compatibilidade)
apiKeysRouter.get('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext

  // [TENANT] Filtra por tenantId + ownerId — agente só vê suas próprias chaves
  const keys = await persistence.apiKeys.listOwned(userPersistenceContext(ctx))

  return c.json(keys)
})

// --- Router de nível de usuário (sem vínculo de projeto) ---

export const userApiKeysRouter = new Hono<HonoEnv>()
userApiKeysRouter.use('*', authMiddleware)

// GET /api-keys — listar chaves do usuário autenticado
userApiKeysRouter.get('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext

  // [TENANT] Filtra por tenantId + ownerId — isolamento cross-tenant obrigatório
  const keys = await persistence.apiKeys.listOwned(userPersistenceContext(ctx))

  return c.json(keys)
})

// POST /api-keys — gerar nova chave
userApiKeysRouter.post('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const parsed = await parseJson(c, userApiKeySchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.name?.trim()) return c.json({ error: 'Nome obrigatório' }, 400)
  if (body.permissionScope && (!Array.isArray(body.permissionScope) || body.permissionScope.some(scope => !API_KEY_PERMISSIONS.includes(scope as typeof API_KEY_PERMISSIONS[number])))) {
    return c.json({ error: 'Escopo de permissão inválido' }, 400)
  }

  const { key } = generateApiKey()
  const keyHash = await hashKey(key)
  const projectScope = body.projectScope ? [...new Set(body.projectScope)] : []
  if (projectScope.length > 0) {
    // O escopo é validado contra projetos do tenant; a autorização final
    // continua sendo a interseção com grupo/membership em cada chamada.
    const scopedProjects = await persistence.projects.listProjectIds(userPersistenceContext(ctx), projectScope)
    if (scopedProjects.length !== projectScope.length) return c.json({ error: 'Escopo contém projeto inválido' }, 400)
  }

  const created = await persistence.apiKeys.create(userPersistenceContext(ctx), {
    ownerId: ctx.userId, name: body.name.trim(), keyHash, aiModelName: body.aiModelName ?? null,
    projectScope: projectScope.length > 0 ? JSON.stringify(projectScope) : null,
    permissionScope: body.permissionScope ? JSON.stringify(body.permissionScope) : null,
    expiresAt: body.expiresAt ?? null,
  })

  // Retorna o valor completo apenas nesta resposta — não é possível recuperá-lo depois
  return c.json({ id: created.id, key, name: body.name }, 201)
})

// DELETE /api-keys/:id — revogar chave (anti-IDOR: verifica tenantId + ownerId + id)
userApiKeysRouter.delete('/:id', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const id = c.req.param('id')

  // [TENANT] Inclui tenantId + ownerId no filtro — retorna 404 se não for do usuário
  const revoked = await persistence.apiKeys.revokeOwned(userPersistenceContext(ctx), id, new Date().toISOString())
  if (!revoked) return c.json({ error: 'Não encontrado' }, 404)

  return c.body(null, 204)
})

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(buf).toString('hex')
}
