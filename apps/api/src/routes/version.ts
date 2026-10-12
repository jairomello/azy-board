import { Hono } from 'hono'
import { resolveApiBuildInfo } from '../buildInfo'

// GET /version — versão e data do build publicados (Card T60). Rota pública,
// sem sessão e sem segredos: serve para conferir qual build está no ar.
export const versionRouter = new Hono()

versionRouter.get('/', async (c) => c.json(await resolveApiBuildInfo()))
