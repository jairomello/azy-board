## Context

A execução do Azy Agent hoje ocorre inline no request HTTP (`void harness.run(...)` em `assistant.ts:529-531`). O status `QUEUED` é persistido mas não há consumidor — a execução começa imediatamente no processo. O padrão `storageCleanup` já demonstra outbox transacional + tabela de jobs com retry/backoff + worker em loop. O `CoordinationPort` (local/Redis) existe mas está desplugado. Os perfis SIMPLE (SQLite) e ADVANCED (PostgreSQL + Redis) já definem a infraestrutura disponível.

## Goals / Non-Goals

**Goals:**
- Runs do agente sobrevivem a restart do processo (fila persistente).
- Execução única por run (claim atômico, sem duplicação entre workers).
- Retry automático com backoff para falhas transitórias.
- Heartbeat/lease detecta workers travados e reivindica runs.
- Cancelamento efetivo entre processos.
- Rate limiting distribuído (plugue no `CoordinationPort`).
- Funciona nos dois perfis sem serviços externos obrigatórios no SIMPLE.

**Non-Goals:**
- Não alterar o contrato SSE/WebSocket do cliente (já funciona com estado no banco).
- Não implementar fila prioritária ou agendamento futuro de jobs.
- Não migrar a execução de tools para outro processo (tools continuam no worker).
- Não alterar a governança/limites do harness (mantidos como estão).

## Decisions

### 1. Reaproveitar `assistant_runs` como tabela de jobs (vs tabela separada)

Adicionar colunas de lease/claim (`claimedBy`, `claimExpiresAt`, `attempts`, `nextAttemptAt`) à tabela `assistant_runs` em vez de criar `agent_jobs` separada. Motivo: o run já tem status (`QUEUED`/`RUNNING`/terminal), idempotência, cursor de eventos e métricas — separar duplicaria estado e exigiria join constante. O índice de varredura `(status, nextAttemptAt)` permite claim eficiente.

*Alternativa:* tabela `agent_jobs` separada — rejeitada por duplicar estado e exigir sincronização entre job e run.

### 2. Claim atômico por UPDATE CAS (ambos os perfis)

O worker reivindica um run com `UPDATE ... SET claimedBy = ?worker, claimExpiresAt = ? WHERE id = ? AND status = 'QUEUED' AND (claimedBy IS NULL OR claimExpiresAt < ?now)`. Se `changes === 1`, o worker é dono; senão, pula. Funciona em SQLite e PostgreSQL sem `SELECT FOR UPDATE`. No ADVANCED, pode-se adicionar `FOR UPDATE SKIP LOCKED` no `listDue` como otimização, mas o CAS é a garantia.

### 3. Worker in-process no SIMPLE, processo separado no ADVANCED

- **SIMPLE**: `startAgentWorker()` roda dentro do processo API (como `startStorageCleanupWorker`), com loop de polling + claim CAS. Zero serviços externos.
- **ADVANCED**: worker pode ser o mesmo processo (polling + `FOR UPDATE SKIP LOCKED`) ou processo separado (`apps/assistant-worker/`). A interface `AgentJobWorker` abstrai a diferença.

*Alternativa:* worker sempre separado — rejeitado para SIMPLE porque exigiria supervisor/processo extra numa instalação que prega zero serviços externos.

### 4. Heartbeat/lease com `claimExpiresAt`

O worker atualiza `claimExpiresAt = now + LEASE_MS` (ex. 60s) periodicamente durante a execução (a cada step ou a cada 15s). Se o processo cair, o lease expira e outro worker pode reivindicar. O `attempts` incrementa a cada claim; após `MAX_ATTEMPTS` (ex. 3), o run vai para `FAILED` com `errorCode = 'WORKER_LOST'`.

### 5. Cancelamento via flag persistida

Adicionar coluna `cancelRequested` (boolean) em `assistant_runs`. A rota `/cancel` seta a flag + transição de status se já terminal. O worker checa a flag a cada step (substituindo o `Set` em memória). Se o run estiver `QUEUED`, o claim o leva direto para `CANCELLED` sem executar.

### 6. Rate limiting via `CoordinationPort`

Substituir o Map em memória por `coordination.checkRateLimit(userId, limit, windowMs)`. No SIMPLE usa `local.ts` (Map do processo — equivalente ao atual mas testável); no ADVANCED usa `redis.ts` (INCR/EXPIRE). O orçamento diário ganha atomicidade com `UPDATE ... WHERE` condicional ou transação curta.

### 7. Aprovação reenfileira em vez de executar inline

Quando uma tool é aprovada (`POST /runs/:runId/approval`), em vez de executar `executeSharedTool` na rota HTTP, a aprovação é persistida e o run volta para `QUEUED`. O worker retoma o run, verifica a aprovação e continua o loop. Isso garante que a execução sempre passe pelo worker (unicidade, lease, métricas).

### 8. Corrigir `expireStaleRuns` para incluir `QUEUED`

A query atual filtra `startedAt < cutoff` que nunca casa com `QUEUED` (`startedAt = NULL`). Corrigir para expirar runs `QUEUED` sem claim ativo (`claimedBy IS NULL OR claimExpiresAt < now`) e runs `RUNNING` com lease expirado.

## Risks / Trade-offs

- **[Claim CAS pode causar starvation]** → mitigar com backoff exponencial no `nextAttemptAt` e fair ordering (oldest first).
- **[Heartbeat frequente sobrecarrega o banco]** → intervalo de 15s com lease de 60s; no ADVANCED usar Redis para lease se necessário.
- **[Worker in-process no SIMPLE limita throughput]** → aceitável: SIMPLE é para até ~20 pessoas; ADVANCED usa worker separado.
- **[Aprovação via reenfileiramento adiciona latência]** → mitigar com claim imediato após enfileirar (o worker que processou o approval pode reivindicar logo em seguida).
- **[Compatibilidade de migração]** → colunas novas com defaults seguros; migração reversível (drop column).
- **[Evento de sequência concorrente]** → `insertEvent` usa read-then-insert; se dois workers processarem o mesmo run (bug), a sequência pode colidir. Mitigação: garantir execução única via claim; índice único `(tenant_id, run_id, sequence)` como rede de segurança.

## Open Questions

- O worker separado no ADVANCED deve ser um container Docker próprio ou pode rodar como sidecar no mesmo container?
- Deve haver métricas OTel específicas para a fila (profundidade, latência de claim, workers ativos)?
