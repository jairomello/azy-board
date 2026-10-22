# Proposal

## Why

Uma recusa de domínio na execução de uma mutação já aprovada (por exemplo, mover um card que tem subtarefas) era tratada como perda de worker: a tool call ficava presa em `RUNNING`, a run era repetida três vezes às cegas e terminava como `FAILED/WORKER_LOST`, escondendo do usuário o motivo real da recusa.

## What Changes

- Execução pós-aprovação passa a classificar a falha da ferramenta aprovada: erro recuperável vira output de tool com o motivo do domínio, a tool call é registrada como falha (nunca fica em `RUNNING`) e a run continua para o modelo explicar ou ajustar a operação.
- Erros determinísticos da run deixam de ser elegíveis a retry com backoff: finalizam a run com o código real do erro, sem consumir budget de recuperação e sem mascaramento como `WORKER_LOST`.
- Recusas 4xx do domínio preservam a mensagem em pt-BR produzida pela própria API, em vez de um texto genérico.
- A decisão de aprovação passa a emitir exatamente um evento `APPROVAL_DECIDED` (hoje a rota e o harness emitem cada um o seu).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `azy-agent-harness`: o requisito de erros recuperáveis como output de tool passa a valer também para a execução de operação já aprovada, que hoje deixava a tool call em `RUNNING` e propagava a exceção.
- `agent-job-queue`: o requisito de retry com backoff passa a excluir explicitamente erros determinísticos da run; o requisito de decisão/retomada idempotente passa a exigir um único evento de decisão por aprovação.

## Impact

- Código: `apps/api/src/services/assistantHarness.ts`, `apps/api/src/services/assistantRunExecutor.ts`, `apps/api/src/services/agentWorker.ts`, `apps/api/src/routes/assistant.ts`.
- Testes: `apps/api/src/services/assistantHarness.test.ts`, `apps/api/src/services/agentJobQueue.test.ts`.
- Sem migração de banco, sem mudança de contrato HTTP e sem nova dependência. O estado de runs já finalizadas não é reescrito.
- `Board ref:` não se aplica — a correção não está vinculada a um card do Azy Board.
