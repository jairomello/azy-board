import { beforeAll, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'
process.env.ASSISTANT_ENCRYPTION_KEY = 'a'.repeat(64)

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users, projects, projectAnalyticsCoverage, assistantCredentials, assistantSettings, assistantConversations, assistantMessages, assistantRuns, assistantEvents, assistantApprovals, assistantToolCalls } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { decryptAssistantSecret, encryptAssistantSecret } = await import('./services/assistantEncryption')
const { probeOpenAICredential } = await import('./services/openaiProvider')
const { estimateRequestedActions, formatAssistantPromptContext, itemTypeScopeForMessage, toolsForMessage, canUseProject } = await import('./routes/assistant')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

async function request(path: string, userId: string, tenantId: string, method = 'GET') {
  const session = await signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
  return app.fetch(new Request(`http://test.local/api${path}`, { method, headers: { cookie: `session=${session}` } }))
}

async function requestJson(path: string, userId: string, tenantId: string, method: string, body: unknown) {
  const session = await signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
  return app.fetch(new Request(`http://test.local/api${path}`, { method, headers: { cookie: `session=${session}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
}

async function user(tenantId: string, group: 'ROOT' | 'ADMIN') {
  const id = generateId()
  await db.insert(users).values({ id, tenantId, email: `${id}@test.local`, passwordHash: 'hash', name: group, globalGroup: group, createdAt: new Date().toISOString(), theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR' })
  return id
}

let tenantId: string
let otherTenantId: string
let rootId: string
let otherRootId: string
let adminId: string

describe('configuração Root do Azy Agent', () => {
  beforeAll(async () => {
    tenantId = generateId()
    otherTenantId = generateId()
    await db.insert(tenants).values([
      { id: tenantId, name: 'Tenant A', slug: `a-${tenantId}`, createdAt: new Date().toISOString() },
      { id: otherTenantId, name: 'Tenant B', slug: `b-${otherTenantId}`, createdAt: new Date().toISOString() },
    ])
    rootId = await user(tenantId, 'ROOT')
    adminId = await user(tenantId, 'ADMIN')
    otherRootId = await user(otherTenantId, 'ROOT')
  })

  test('exige ROOT e isola o tenant', async () => {
    expect((await request('/assistant/root', adminId, tenantId)).status).toBe(403)
    expect((await request('/assistant/root', otherRootId, otherTenantId)).status).toBe(200)
    const response = await request('/assistant/root', rootId, tenantId)
    expect(await response.json()).toMatchObject({ enabled: false, configured: false })
  })

  test('expõe somente disponibilidade para usuário não-Root', async () => {
    const response = await request('/assistant/availability', adminId, tenantId)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ enabled: false, configured: false })
  })

  test('Root consulta e configura governança do tenant dentro de limites seguros', async () => {
    const current = await request('/assistant/root', rootId, tenantId)
    expect((await current.json() as { governance: { requestsPerMinute: number } }).governance.requestsPerMinute).toBe(10)
    const updated = await requestJson('/assistant/root/governance', rootId, tenantId, 'PATCH', { requestsPerMinute: 40, maxSteps: 12, dailyBudgetMicros: 4_000_000 })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({ governance: { requestsPerMinute: 40, maxSteps: 12, dailyBudgetMicros: 4_000_000 } })
    expect((await requestJson('/assistant/root/governance', rootId, tenantId, 'PATCH', { maxSteps: 0 })).status).toBe(400)
    expect((await requestJson('/assistant/root/governance', adminId, tenantId, 'PATCH', { maxSteps: 12 })).status).toBe(403)
  })

  test('revogação desabilita e remove referência utilizável', async () => {
    const now = new Date().toISOString()
    const credentialId = generateId()
    await db.insert(assistantCredentials).values({ id: credentialId, tenantId, provider: 'OPENAI', credentialMode: 'API_KEY', ciphertext: (await encryptAssistantSecret('secret-value')).ciphertext, ciphertextVersion: 1, keyPrefix: 'sk-test...', scopesJson: '[]', createdBy: rootId, createdAt: now })
    await db.insert(assistantSettings).values({ tenantId, enabled: true, provider: 'OPENAI', model: 'gpt-4o-mini', credentialMode: 'API_KEY', credentialId, validationStatus: 'VALID', validatedAt: now, updatedAt: now }).onConflictDoUpdate({ target: assistantSettings.tenantId, set: { enabled: true, credentialId, validationStatus: 'VALID' } })
    const response = await request('/assistant/root/provider/revoke', rootId, tenantId, 'POST')
    expect(response.status).toBe(200)
    const setting = (await db.select().from(assistantSettings).where(eq(assistantSettings.tenantId, tenantId)))[0]!
    expect(setting).toMatchObject({ enabled: false, credentialId: null, validationStatus: 'UNVALIDATED' })
    expect((await db.select().from(assistantCredentials).where(eq(assistantCredentials.id, credentialId)))[0]?.revokedAt).toBeString()
  })

  test('cifra segredo sem permitir recuperá-lo do ciphertext', async () => {
    const encrypted = await encryptAssistantSecret('sk-secret-value')
    expect(encrypted.ciphertext).not.toContain('sk-secret-value')
    expect(await decryptAssistantSecret(encrypted.ciphertext, encrypted.version)).toBe('sk-secret-value')
  })

  test('converte timeout do provider em resultado seguro', async () => {
    const result = await probeOpenAICredential('sk-test', 'gpt-4o-mini', {
      timeoutMs: 5,
      fetch: (async () => await new Promise<Response>(() => undefined)) as unknown as typeof fetch,
    })
    expect(result).toMatchObject({ status: 'INVALID', reason: 'Timeout ao testar o provider' })
  })
})

describe('API de chat do Azy Agent', () => {
  let conversationId: string
  let runId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    const credentialId = generateId()
    await db.insert(assistantCredentials).values({ id: credentialId, tenantId, provider: 'OPENAI', credentialMode: 'API_KEY', ciphertext: (await encryptAssistantSecret('chat-secret')).ciphertext, ciphertextVersion: 1, keyPrefix: 'sk-chat...', scopesJson: '[]', createdBy: rootId, createdAt: now })
    await db.update(assistantSettings).set({ enabled: true, provider: 'OPENAI', model: 'gpt-4o-mini', credentialMode: 'API_KEY', credentialId, validationStatus: 'VALID', validatedAt: now, updatedAt: now }).where(eq(assistantSettings.tenantId, tenantId))
  })

  test('cria, lista e isola conversa por ownership', async () => {
    const created = await requestJson('/assistant/conversations', rootId, tenantId, 'POST', { title: 'Privada' })
    expect(created.status).toBe(201)
    conversationId = (await created.json() as { id: string }).id
    expect((await request('/assistant/conversations', adminId, tenantId)).status).toBe(200)
    expect((await request(`/assistant/conversations/${conversationId}`, adminId, tenantId)).status).toBe(404)
    expect((await request(`/assistant/conversations/${conversationId}`, otherRootId, otherTenantId)).status).toBe(404)
  })

  test('bloqueia Admin sem associação em projeto restrito no Azy Agent', async () => {
    const projectId = generateId()
    await db.insert(projects).values({
      id: projectId,
      // [TENANT] Projeto restrito pertence ao tenant da conversa autenticada.
      tenantId,
      name: 'Projeto restrito do agente',
      isRestricted: true,
      isHidden: false,
      createdAt: new Date().toISOString(),
    })
    await db.insert(projectAnalyticsCoverage).values({
      projectId,
      // [TENANT] Cobertura do fixture permanece no tenant do projeto.
      tenantId,
      coverageStartedAt: new Date().toISOString(),
      baselineEventId: null,
      createdAt: new Date().toISOString(),
    })

    expect(await canUseProject(tenantId, adminId, 'ADMIN', projectId)).toBe(false)
    const response = await requestJson('/assistant/conversations', adminId, tenantId, 'POST', { projectId })
    expect(response.status).toBe(404)
  })

  test('bloqueia tamanho e quantidade de ações antes de persistir mensagem ou run', async () => {
    const messagesBefore = (await db.select().from(assistantMessages)).length
    const runsBefore = (await db.select().from(assistantRuns)).length
    const tooLong = await requestJson(`/assistant/conversations/${conversationId}/messages`, rootId, tenantId, 'POST', { content: 'á'.repeat(15_001) })
    expect(tooLong.status).toBe(413)
    expect(await tooLong.json()).toMatchObject({ code: 'PAYLOAD_LIMIT', retryable: false })
    const tooMany = Array.from({ length: 21 }, (_, index) => `Task — Ação ${index + 1}`).join('\n')
    const excessive = await requestJson(`/assistant/conversations/${conversationId}/messages`, rootId, tenantId, 'POST', { content: tooMany })
    expect(excessive.status).toBe(413)
    expect(await excessive.json()).toMatchObject({ code: 'ACTION_LIMIT', retryable: false })
    expect(await db.select().from(assistantMessages)).toHaveLength(messagesBefore)
    expect(await db.select().from(assistantRuns)).toHaveLength(runsBefore)
  })

  test('estima itens estruturados sem contar cabeçalho e Tipo duas vezes', () => {
    const prompt = 'Épico 1 — E\nTipo: EPIC\nHistória 1.1 — S\nTipo: STORY\nTask — T\nTipo: TASK'
    expect(estimateRequestedActions(prompt)).toBe(3)
    expect(toolsForMessage(`Cadastre a estrutura abaixo\n${prompt}`)).toEqual(['batch'])
    expect(toolsForMessage(`Crie um projeto e cadastre a estrutura abaixo\n${prompt}`)).toEqual(['create_project_structure'])
  })

  test('prioriza movimentação atual sobre criação mencionada no histórico', () => {
    const tools = toolsForMessage("mova a tarefa 'Criar formulário' para 'Fazendo'", 'Cadastre a estrutura abaixo com EPIC, STORY e TASK em lote')
    expect(tools).toEqual(['list_tasks', 'list_columns', 'move_task'])
    expect(tools.includes('batch')).toBe(false)
  })

  test('classifica movimentação de vários itens como atualização filtrada atômica', () => {
    expect(toolsForMessage("Mova todas as tasks que estão na história 'Dashboard Demo' na lista 'A Fazer' para a lista 'Em Review'."))
      .toEqual(['update_items'])
    expect(itemTypeScopeForMessage("Mova todas as tasks que estão na história 'Dashboard Demo'"))
      .toEqual(['TASK', 'BUG'])
    expect(itemTypeScopeForMessage("Mova todos os cards que estão na história 'Dashboard Demo'"))
      .toEqual(['TASK', 'BUG'])
    expect(itemTypeScopeForMessage("Mova somente as tasks, sem bugs, que estão na história 'Dashboard Demo'"))
      .toEqual(['TASK'])
    expect(itemTypeScopeForMessage("Mova todos os bugs que estão na história 'Dashboard Demo'"))
      .toEqual(['BUG'])
  })

  test('regressão: comando original move todos os cards da lista na história', () => {
    const command = "Mova todas as tasks que estão na história 'Dashboard Demo' na lista 'A Fazer' para a lista 'Em Review'."

    expect(toolsForMessage(command)).toEqual(['update_items'])
    expect(itemTypeScopeForMessage(command)).toEqual(['TASK', 'BUG'])
  })

  test('classifica definição de datas em todas as tasks como mutação atômica', () => {
    expect(toolsForMessage('Defina a data de início de cada task pela criação e a data fim como hoje')).toEqual(['update_items'])
    expect(toolsForMessage('Altere as datas de fim de todas as tasks deste board para amanhã')).toEqual(['update_items'])
    expect(toolsForMessage('Altere os responsáveis de todos os bugs da versão 2.0')).toEqual(['update_items'])
    expect(itemTypeScopeForMessage('Altere todas as tasks e bugs')).toEqual(['TASK', 'BUG'])
    expect(itemTypeScopeForMessage('Altere todos os itens')).toBeUndefined()
  })

  test('formata contexto autoritativo de usuário, projeto e item', () => {
    const prompt = formatAssistantPromptContext({
      currentDate: '2026-09-03',
      authenticatedUser: { id: 'u1', name: 'Usuário', email: 'user@test.local', globalGroup: 'TEAM_MEMBER', language: 'pt-BR' },
      selectedProject: { id: 'p1', name: 'Projeto' },
      selectedItem: { id: 't1', title: 'Task', type: 'TASK', ancestry: [{ id: 'e1', title: 'Épico', type: 'EPIC' }] },
    })
    expect(prompt).toContain('"globalGroup":"TEAM_MEMBER"')
    expect(prompt).toContain('"selectedProject":{"id":"p1","name":"Projeto"}')
    expect(prompt).toContain('"ancestry":[{"id":"e1","title":"Épico","type":"EPIC"}]')
  })

  test('rejeita itemId inválido antes de persistir mensagem ou run', async () => {
    const messagesBefore = (await db.select().from(assistantMessages)).length
    const runsBefore = (await db.select().from(assistantRuns)).length
    const malformed = await requestJson(`/assistant/conversations/${conversationId}/messages`, rootId, tenantId, 'POST', { content: 'Revise', itemId: { id: 'inventado' } })
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toMatchObject({ code: 'INVALID_REQUEST' })
    const missing = await requestJson(`/assistant/conversations/${conversationId}/messages`, rootId, tenantId, 'POST', { content: 'Revise', itemId: generateId() })
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ code: 'ITEM_NOT_FOUND' })
    expect(await db.select().from(assistantMessages)).toHaveLength(messagesBefore)
    expect(await db.select().from(assistantRuns)).toHaveLength(runsBefore)
  })

  test('recusa reutilizar conversa fora do projeto selecionado', async () => {
    const response = await requestJson(`/assistant/conversations/${conversationId}/messages`, rootId, tenantId, 'POST', { content: 'Liste as tasks', projectId: generateId() })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'CONVERSATION_PROJECT_MISMATCH', retryable: false })
  })

  test('entrega eventos SSE somente após o cursor informado', async () => {
    const now = new Date().toISOString()
    runId = generateId()
    await db.insert(assistantRuns).values({ id: runId, tenantId, conversationId, userId: rootId, status: 'COMPLETED', model: 'gpt-4o-mini', currentCursor: 2, createdAt: now, finishedAt: now })
    await db.insert(assistantEvents).values([
      { id: generateId(), tenantId, runId, sequence: 1, eventType: 'RUN_CREATED', payloadJson: JSON.stringify({ secret: 'must-not-be-here' }), createdAt: now },
      { id: generateId(), tenantId, runId, sequence: 2, eventType: 'RUN_COMPLETED', payloadJson: JSON.stringify({ ok: true }), createdAt: now },
    ])
    const response = await request(`/assistant/runs/${runId}/events?cursor=1`, rootId, tenantId)
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('id: 2')
    expect(text).toContain(`"runId":"${runId}"`)
    expect(text).not.toContain('id: 1')
    expect(text).not.toContain('must-not-be-here')
  })

  test('não permite cancelar run de outro usuário ou tenant', async () => {
    expect((await request(`/assistant/runs/${runId}/cancel`, adminId, tenantId, 'POST')).status).toBe(404)
    expect((await request(`/assistant/runs/${runId}/cancel`, otherRootId, otherTenantId, 'POST')).status).toBe(404)
  })

  test('responde pergunta e aprovação somente no estado e ownership corretos', async () => {
    const now = new Date().toISOString()
    const questionRun = generateId()
    await db.insert(assistantRuns).values({ id: questionRun, tenantId, conversationId, userId: rootId, status: 'WAITING_USER', model: 'gpt-4o-mini', createdAt: now })
    const answer = await requestJson(`/assistant/runs/${questionRun}/question`, rootId, tenantId, 'POST', { answer: 'Projeto principal' })
    expect(answer.status).toBe(200)
    expect(await answer.json()).toMatchObject({ runId: questionRun, status: 'QUEUED' })

    const approvalRun = generateId(), toolCallId = generateId(), operation = 'f'.repeat(64)
    await db.insert(assistantRuns).values({ id: approvalRun, tenantId, conversationId, userId: rootId, status: 'WAITING_APPROVAL', model: 'gpt-4o-mini', createdAt: now })
    await db.insert(assistantToolCalls).values({ id: toolCallId, tenantId, runId: approvalRun, toolName: 'create_task', riskLevel: 'MEDIUM', status: 'WAITING_APPROVAL', argumentsJson: JSON.stringify({ projectId: 'p1', title: 'X' }), operationHash: operation, createdAt: now })
    await db.insert(assistantApprovals).values({ id: generateId(), tenantId, runId: approvalRun, toolCallId, status: 'PENDING', previewJson: '{}', operationHash: operation, expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: now })
    expect((await requestJson(`/assistant/runs/${approvalRun}/approval`, adminId, tenantId, 'POST', { approved: true, operationHash: operation })).status).toBe(404)
    const rejected = await requestJson(`/assistant/runs/${approvalRun}/approval`, rootId, tenantId, 'POST', { approved: false, operationHash: operation })
    expect(rejected.status).toBe(200)
    expect(await rejected.json()).toMatchObject({ runId: approvalRun, status: 'COMPLETED' })
  })
})
