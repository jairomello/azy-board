import type { Context, Next } from 'hono'

const AGENT_ACCEPT = 'application/vnd.azyboard.agent+json'

function isAgentRequest(c: Context) {
  return c.req.header('Accept')?.includes(AGENT_ACCEPT) === true
}

export async function agentResponseMiddleware(c: Context, next: Next) {
  await next()
  if (!isAgentRequest(c) || !c.res.headers.get('content-type')?.includes('application/json')) return

  const body = await c.res.json().catch(() => null) as Record<string, unknown> | unknown[] | null
  if (body === null) return

  if (c.res.status >= 400) {
    return
  }

  const legacy = body as Record<string, unknown>
  const paginated = !Array.isArray(body) && Array.isArray(legacy.data)
  const data = paginated ? legacy.data : body
  const meta = paginated
    ? Object.fromEntries(Object.entries(legacy).filter(([key]) => key !== 'data'))
    : { count: Array.isArray(body) ? body.length : 1 }
  c.res = new Response(JSON.stringify({ data, meta }), { status: c.res.status, headers: { 'Content-Type': 'application/json' } })
}

export const AGENT_RESPONSE_MEDIA_TYPE = AGENT_ACCEPT
