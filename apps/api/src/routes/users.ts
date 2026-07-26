import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import type { HonoEnv } from '../types/hono'
import type { Language, LightShellTheme, RequestContext, Theme } from '@azy-board/types'
import { db } from '../db'
import { users } from '../db/schema'
import { authMiddleware } from '../middleware/auth'

const THEMES = new Set<Theme>(['light', 'dark'])
const LANGUAGES = new Set<Language>(['pt-BR', 'en', 'es'])
const LIGHT_SHELL_THEMES = new Set<LightShellTheme>([
  'petroleum',
  'ocean',
  'emerald',
  'graphite',
  'classic',
])
const ALLOWED_FIELDS = new Set(['theme', 'lightShellTheme', 'language'])

export const usersRouter = new Hono<HonoEnv>()
usersRouter.use('*', authMiddleware)

usersRouter.patch('/me', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json<Record<string, unknown>>()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const keys = Object.keys(body)
  if (keys.length === 0 || keys.some((key) => !ALLOWED_FIELDS.has(key))) {
    return c.json({ error: 'Informe ao menos uma preferência válida' }, 400)
  }
  if (body.theme !== undefined && !THEMES.has(body.theme as Theme)) {
    return c.json({ error: 'Tema inválido' }, 400)
  }
  if (body.lightShellTheme !== undefined && !LIGHT_SHELL_THEMES.has(body.lightShellTheme as LightShellTheme)) {
    return c.json({ error: 'Tema estrutural inválido' }, 400)
  }
  if (body.language !== undefined && !LANGUAGES.has(body.language as Language)) {
    return c.json({ error: 'Idioma inválido' }, 400)
  }

  const ctx = c.get('ctx') as RequestContext
  const updates: Partial<{
    theme: Theme
    lightShellTheme: LightShellTheme
    language: Language
  }> = {}
  if (body.theme !== undefined) updates.theme = body.theme as Theme
  if (body.lightShellTheme !== undefined) updates.lightShellTheme = body.lightShellTheme as LightShellTheme
  if (body.language !== undefined) updates.language = body.language as Language

  // [TENANT] O alvo é derivado exclusivamente da sessão e filtrado por usuário + tenant.
  await db.update(users)
    .set(updates)
    .where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)))

  const user = await db.query.users.findFirst({
    where: (u) => and(eq(u.id, ctx.userId), eq(u.tenantId, ctx.tenantId)),
    columns: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      theme: true,
      lightShellTheme: true,
      language: true,
    },
  })

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)
  return c.json({ user })
})
