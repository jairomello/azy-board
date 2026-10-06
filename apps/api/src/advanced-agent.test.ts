import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client, type Pool } from 'pg'
import { shouldRunPostgresTests } from './db/postgres/pgTestSupport'
import type { PersistencePorts } from './persistence/ports'
import type { ModelProvider, ModelResponse } from './services/openaiProvider'

// [ADVANCED-AGENT] Jornada determinística do agente contra PostgreSQL real:
// provider scriptado conduz leitura → mutação (aprovação) → execução, e a fila,
// tool calls, aprovação e eventos são persistidos pelo adapter PostgreSQL.
// Nenhum mock de banco; apenas a ferramenta externa é determinística.
// Quando T37 separar o worker, este teste deve subir o worker dedicado.
const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_advanced_agent'
const runPostgres = await shouldRunPostgresTests(PG_URL)
const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-advanced-agent-'))

class ScriptedProvider implements ModelProvider {
  readonly name = 'scripted-test'
  readonly capabilities = { tools: true, streaming: true, cancellation: true } as const
  calls = 0
  constructor(private readonly projectId: string, private readonly itemId: string) {}
  async createRun(): Promise<ModelResponse> {
    this.calls += 1
    if (this.calls === 1) return { id: 'a1', output: [{ type: 'function_call', name: 'list_projects', callId: 'read-1', arguments: '{}' }] }
    if (this.calls === 2) {
      return { id: 'a2', output: [{ type: 'function_call', name: 'create_item_log', callId: 'write-1', arguments: JSON.stringify({ projectId: this.projectId, itemId: this.itemId, activity: 'Revisão determinística', durationMin: 30 }) }] }
    }
    return { id: 'a3', output: [{ type: 'message', text: 'Operação concluída.' }] }
  }
  async *streamRun() { yield { type: 'text_delta' as const, text: 'ok' } }
}

describe.skipIf(!runPostgres)('ADVANCED agente — run/tool/aprovação/SSE (PostgreSQL real)', () => {
  let ports: PersistencePorts
  let pool: Pool
  let closeRuntime: () => Promise<void>
  let tenantId: string
  let userId: string
  let projectId: string
  let itemId: string
  let conversationId: string

  beforeAll(async () => {
    process.env.AZYBOARD_INSTALL_PROFILE = 'ADVANCED'
    process.env.DATABASE_URL = PG_URL
    process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379'
    process.env.AZYBOARD_INSTANCE_DIR = instanceDir
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'advanced-agent-test-secret'

    const setup = new Client({ connectionString: PG_URL })
    await setup.connect()
    await setup.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    await setup.end()
    const migrationsDir = join(import.meta.dir, 'db', 'postgres', 'migrations')
    const files = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
    const client = new Client({ connectionString: PG_URL })
    await client.connect()
    for (const file of files) await client.query(readFileSync(join(migrationsDir, file), 'utf8'))
    await client.end()

    const runtime = await import('./persistence/runtime')
    closeRuntime = runtime.closeRuntime
    ports = runtime.persistence
    const { ensureInstallationMarkers } = await import('./db/installationMarkers')
    await ensureInstallationMarkers(runtime.installProfile, runtime.createMarkerStore())

    tenantId = crypto.randomUUID()
    userId = crypto.randomUUID()
    conversationId = crypto.randomUUID()
    const now = new Date().toISOString()

    const tenant = await ports.tenants.createTenant({ name: 'Agente ADV', slug: `agente-${tenantId.slice(0, 8)}` })
    tenantId = tenant.id
    const user = await ports.identity.createUser(
      { tenantId, actorUserId: null, actorKind: 'SYSTEM' },
      { email: 'agent-user@advanced.test', passwordHash: 'hash', name: 'Agente', globalGroup: 'TEAM_MEMBER' },
    )
    userId = user.id
    const project = await ports.unitOfWork.createProjectAggregate(
      { tenantId, actorUserId: userId, actorKind: 'USER', mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null } },
      { project: { name: 'Projeto Agente', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'A Fazer', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'Geral', simpleStoryTitle: 'Fluxo' },
    )
    projectId = project.id
    const item = await ports.unitOfWork.createItemWithRelations(
      { tenantId, actorUserId: userId, actorKind: 'USER', mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null } },
      { projectId, type: 'TASK', title: 'Tarefa agente', parentId: project.simpleStoryId },
    )
    itemId = item.id
    await ports.agent.createConversation({ tenantId, actorUserId: userId, actorKind: 'USER' }, {
      id: conversationId, userId, projectId, title: 'Jornada determinística', now,
    })
  })

  afterAll(async () => {
    await closeRuntime?.()
  })

  test('executa leitura, pausa para aprovação e persiste eventos/tool calls', async () => {
    const { AssistantHarness } = await import('./services/assistantHarness')
    const provider = new ScriptedProvider(projectId, itemId)
    const harness = new AssistantHarness({
      provider,
      authorize: async () => {},
      executeTool: async () => ({ ok: true, logId: 'deterministic-log' }),
    })
    const scope = { tenantId, actorUserId: userId, actorKind: 'USER' as const }

    const result = await harness.run(
      { source: 'azy-agent', userId, tenantId, globalGroup: 'TEAM_MEMBER', projectId, conversationId },
      'gpt-4o-mini', 'registre 30 min de revisão', `agent-${crypto.randomUUID()}`,
    )
    expect(result.status).toBe('WAITING_APPROVAL')
    expect(provider.calls).toBe(2)

    const run = await ports.agent.getRun(scope, result.runId)
    expect(run?.status).toBe('WAITING_APPROVAL')

    const toolCalls = await ports.agent.listToolCalls(scope, result.runId)
    const readCall = toolCalls.find(call => call.toolName === 'list_projects')
    const writeCall = toolCalls.find(call => call.toolName === 'create_item_log')
    expect(readCall?.status).toBe('COMPLETED')
    expect(writeCall?.status).toBe('WAITING_APPROVAL')

    const approval = await ports.agent.listPendingApproval(scope, result.runId)
    expect(approval).toBeTruthy()

    const events = await ports.agent.listEventsAfter(scope, result.runId, 0)
    const types = events.map(event => event.eventType)
    expect(types).toContain('RUN_STARTED')
    expect(types).toContain('TOOL_COMPLETED')
    expect(types).toContain('APPROVAL_REQUIRED')

    // Aprova e executa a mutação: resultado persistido pelo adapter PostgreSQL.
    await harness.approve(result.runId, tenantId, userId, approval!.operationHash)
    await harness.executeApproved({
      source: 'azy-agent', userId, tenantId, globalGroup: 'TEAM_MEMBER', projectId, conversationId, runId: result.runId,
    })
    const completed = (await ports.agent.listToolCalls(scope, result.runId)).find(call => call.toolName === 'create_item_log')
    expect(completed?.status).toBe('COMPLETED')
    expect(completed?.resultSummary).toBeTruthy()

    const afterEvents = await ports.agent.listEventsAfter(scope, result.runId, 0)
    expect(afterEvents.map(event => event.eventType)).toContain('APPROVAL_DECIDED')
    // SSE: cursor avançado retorna apenas eventos posteriores.
    const tail = await ports.agent.listEventsAfter(scope, result.runId, afterEvents.length - 1)
    expect(tail.length).toBeLessThanOrEqual(1)
  })
})
