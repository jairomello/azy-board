Board ref: 341ba802-bef6-4659-a15d-385749b469c1

## Why

`startServer()` inicia o worker na API também em ADVANCED, e `AgentWorker.heartbeat()` perde a referência da run sem interromper sua execução. T37 é P0: claim inicial exclusivo não impede o antigo proprietário de continuar gravando ou executando ferramentas depois de outro worker assumir.

## What Changes

- **BREAKING operacional (ADVANCED):** consumir runs exclusivamente por entrada/processo de worker separado, com serviço de deploy próprio; API somente enfileira, consulta, aprova e cancela. SIMPLE conserva worker in-process como modo explícito validado.
- Adicionar geração monotônica de lease (fencing) e validar posse vigente em toda continuação, gravação, conclusão, heartbeat e efeito de ferramenta; abortar I/O em perda de posse ou cancelamento.
- Recuperar runs por checkpoints e identidade estável de operação; tornar retry, aprovação repetida, cancelamento concorrente e crash após commit determinísticos.
- Testar dois workers reais, pausa/expiração de lease, restart da API, falhas de provider e retomada de ferramenta, com métricas e procedimentos operacionais.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `agent-worker-process`: lifecycle por perfil, separação ADVANCED, contexto de execução com fence/abort e observabilidade operacional.
- `agent-job-queue`: claim e lease com geração, recuperação sem efeitos duplicados e cancelamento serializado com execução.

## Impact

- `apps/api/src/index.ts`, `services/{agentWorker,agentJobQueue,assistantRunExecutor,assistantHarness,workerContext}.ts`, `routes/assistant.ts`, `persistence/{ports,models}.ts` e adapters/migrations de ambos os dialects.
- Entrada de worker a criar, scripts de execução, imagem/entrypoint e `docker-compose.advanced.yml`, CI e `DEPLOY.md`.
- T36 fornece bootstrap PostgreSQL e lifecycle por perfil. T38 fornece chave/hash/resultado e efeito de domínio no mesmo commit; T37 entrega geração, checkpoints e integração, sem outro journal/outbox. T39 entrega realtime de board, não fila de runs.
- Extração compartilhada API/MCP é T40; esta change não cria pacote executor concorrente. Abort não desfaz requisição externa já aceita: efeitos externos incertos exigem reconciliação/idempotência do destino, nunca repetição cega.
