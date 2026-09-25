# Tasks — add-agent-job-queue

## 1. Schema e migrações

- [x] 1.1 Adicionar colunas de lease/claim em `assistant_runs`: `claimedBy` (text), `claimExpiresAt` (timestamp), `attempts` (int default 0), `nextAttemptAt` (timestamp), `cancelRequested` (boolean default false) — migração SQLite + PostgreSQL
- [x] 1.2 Criar índice de varredura `agent_queue_scan_idx (status, nextAttemptAt)` para claim eficiente
- [x] 1.3 Corrigir `expireStaleRuns` para expirar runs `QUEUED` sem claim ativo e runs `RUNNING` com lease expirado (atualmente `startedAt < cutoff` ignora `QUEUED`)
- [x] 1.4 Adicionar `claimRun` (UPDATE CAS), `heartbeatRun` (estende `claimExpiresAt`), `releaseRun` (limpa claim), `requestCancel` (seta flag) em `AgentPort` + implementações SQLite e PostgreSQL

## 2. Fila e claim

- [x] 2.1 Implementar `AgentJobQueue`: `enqueue(runId)`, `claimNext(workerId, leaseMs)`, `release(runId, retryWithBackoff)`, `expireOrphaned()`
- [x] 2.2 Implementar backoff exponencial para retry (base 5s, max 5min, max 3 tentativas antes de `FAILED WORKER_LOST`)
- [x] 2.3 Implementar `listDue` para claim (filtro `status = 'QUEUED' AND (claimedBy IS NULL OR claimExpiresAt < now) AND nextAttemptAt <= now`, ordenado por `createdAt`)
- [x] 2.4 No ADVANCED, adicionar `FOR UPDATE SKIP LOCKED` no `listDue` do adapter PostgreSQL (otimização; CAS continua sendo a garantia)

## 3. Worker

- [x] 3.1 Criar `AgentWorker` com loop de polling + claim + execução + heartbeat (intervalo 15s, lease 60s)
- [x] 3.2 Plugues de execução: `executeRun(runId)` reutiliza `AssistantHarness.run()` com contexto reconstruído do banco (usuário, tenant, projeto, provider, governance)
- [x] 3.3 Worker in-process no SIMPLE: `startAgentWorker()` chamado em `startServer` (como `startStorageCleanupWorker`)
- [x] 3.4 Worker separado no ADVANCED (opcional): `apps/assistant-worker/` ou flag `AZY_AGENT_WORKER=external` para desligar o worker in-process
- [x] 3.5 Checar `cancelRequested` a cada step do loop do harness; interromper e finalizar como `CANCELLED`

## 4. Acoplamentos do HTTP

- [x] 4.1 `runMessage()`: em vez de `void harness.run(...)`, apenas persistir a mensagem e deixar o run na fila (já faz `createRun` → `QUEUED`; remover o fire-and-forget)
- [x] 4.2 Aprovação (`POST /runs/:runId/approval`): persistir aprovação + reenfileirar run (`QUEUED`) em vez de executar `executeSharedTool` inline
- [x] 4.3 Pergunta (`POST /runs/:runId/question`): já retorna `QUEUED`; garantir que o worker consome (hoje ninguém consome)
- [x] 4.4 Cancelamento (`POST /runs/:runId/cancel`): setar `cancelRequested` + transição de status (se `QUEUED`, finalizar `CANCELLED` direto)
- [x] 4.5 Rate limiting: trocar Map em memória por `CoordinationPort.checkRateLimit` (plugue local/Redis por perfil)
- [x] 4.6 Orçamento diário: tornar verificação atômica (transação curta ou UPDATE condicional)

## 5. Reconstrução de contexto no worker

- [x] 5.1 Implementar `loadRunContext(runId)`: recuperar usuário, tenant, projeto, credencial (descriptografada), governance, allowlist e mensagens do banco
- [x] 5.2 Implementar `toolApi` para worker: dispatch de tools sem cookie HTTP (usar `SYSTEM` actor ou token de run com revalidação de permissão)
- [x] 5.3 Garantir que `authorizeAssistantTool` funcione no contexto do worker (revalidar usuário/tenant/projeto do banco)

## 6. Observabilidade

- [x] 6.1 Métricas OTel: `agent.queue.depth`, `agent.queue.claim_latency_ms`, `agent.worker.active_runs`, `agent.worker.lease_expirations`
- [x] 6.2 Logs estruturados: claim (workerId, runId), conclusão (status, duração, attempts), lease expirado, cancelamento detectado

## 7. Testes

- [x] 7.1 Teste de claim atômico: dois workers concorrem, apenas um executa
- [x] 7.2 Teste de lease: worker cai, lease expira, outro worker reivindica
- [x] 7.3 Teste de retry: erro transitório → backoff → reenfileiramento → nova tentativa
- [x] 7.4 Teste de cancelamento: flag persistida → worker interrompe → `CANCELLED`
- [x] 7.5 Teste de retomada após aprovação: aprovação → `QUEUED` → worker retoma → executa
- [x] 7.6 Teste de expiração: run `QUEUED` órfão → `EXPIRED`; run `RUNNING` com lease expirado → reivindicado ou `FAILED`
- [x] 7.7 Teste de paridade SIMPLE ↔ ADVANCED (fila funciona nos dois perfis)
- [x] 7.8 Teste de integração: fluxo completo HTTP → fila → worker → SSE → conclusão

## 8. Verificação e encerramento

- [x] 8.1 Rodar `bun run check` (typecheck + lint + persistência + testes + build) e corrigir divergências
- [x] 8.2 Rodar `bun run test:smoke` e `bun run check:bundle` para o impacto do frontend
- [x] 8.3 Rodar a bateria E2E (`bun run test:regression --with-e2e`) confirmando que o fluxo do agente funciona com o worker
- [x] 8.4 Rodar `openspec validate add-agent-job-queue`
- [x] 8.5 Registrar o acompanhamento com `Board ref: 2e763f85-8fde-4e3d-ab0e-4546e3d77bc0` e fechar o card com `complete_task`, confirmando no board que entrou em coluna `DONE`
