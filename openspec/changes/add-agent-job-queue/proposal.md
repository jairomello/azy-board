## Why

A execução do Azy Agent vive dentro do processo HTTP via `void harness.run(...)` (fire-and-forget). Se o processo reiniciar, a execução é perdida e o cliente fica preso em `QUEUED`/`RUNNING` sem recuperação. Não há retry confiável, garantia de execução única, nem consumidor de runs `QUEUED` (inclusive após `/runs/:runId/question`). Rate limit usa Map em memória, orçamento é leitura-seguida-de-escrita, e cancelamento é um Set local — tudo perdido em restart e inseguro em múltiplas instâncias.

## What Changes

- Criar fila persistente de jobs para runs do agente, com claim atômico, retry com backoff e expiração de runs órfãos.
- Separar o worker de execução do processo HTTP: o endpoint apenas enfileira e responde 202; o worker consome e executa.
- Implementar heartbeat/lease no worker para detectar execuções travadas e reivindicar por outro worker.
- Conectar o `CoordinationPort` (já existente: local/Redis) para rate limiting distribuído e coordenação multi-instância.
- Garantir execução única por run via claim CAS no banco (UPDATE condicional por status).
- Tornar cancelamento efetivo entre processos (flag persistida em vez de Set em memória).
- Funcionar nos dois perfis: SIMPLE (SQLite, polling + claim CAS) e ADVANCED (PostgreSQL + Redis, `FOR UPDATE SKIP LOCKED`).
- Corrigir `expireStaleRuns` para também expirar runs `QUEUED` (hoje `startedAt = NULL` nunca é expirado).
- Aprovação de tools passa a enfileirar retomada do run em vez de executar inline no HTTP.

## Capabilities

### New Capabilities
- `agent-job-queue`: fila persistente de jobs para execução do Azy Agent — enfileiramento, claim atômico, retry, expiração, heartbeat/lease e execução única.
- `agent-worker-process`: worker separado do processo HTTP que consome a fila, executa runs e coordena com outros workers (lock, lease, cancelamento).

### Modified Capabilities
- `azy-agent-harness`: a execução do `harness.run()` passa a ocorrer no worker, não no request HTTP; cancelamento e aprovação tornam-se cross-process; retomada após `WAITING_USER`/`WAITING_APPROVAL` via reenfileiramento.

## Impact

- **API**: `apps/api/src/routes/assistant.ts` (fluxo de `runMessage`, aprovação, cancelamento); novo módulo de fila/claim.
- **Worker**: novo processo `apps/assistant-worker/` (ou worker in-process no SIMPLE, documentado).
- **Banco**: nova tabela `agent_jobs` (ou reaproveitar `assistant_runs` com colunas de lease/claim); migração SQLite + PostgreSQL.
- **Coordenação**: plugues em `coordination/` para rate limit distribuído; lock de execução.
- **Frontend**: sem mudança de UI — SSE já faz polling do banco e funciona com worker separado.
- **Perfis**: SIMPLE mantém zero serviços externos (worker in-process com claim CAS); ADVANCED usa PostgreSQL + Redis.
- **Rastreabilidade**: Board ref `2e763f85-8fde-4e3d-ab0e-4546e3d77bc0` (Item 4).
