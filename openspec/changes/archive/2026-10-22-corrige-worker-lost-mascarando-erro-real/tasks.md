# Tasks

## 1. Recusa recuperável na execução pós-aprovação

- [x] 1.1 Introduzir `ApprovedExecutionOutcome` (`EXECUTED` | `REJECTED`) em `AssistantHarness.executeApproved` e devolver `EXECUTED` no caminho de sucesso — verificado por `bun run --cwd apps/api typecheck`
- [x] 1.2 Envolver a execução da ferramenta aprovada em `try/catch`: marcar a tool call como `FAILED` com o resumo do erro e devolver `REJECTED` quando o erro for recuperável, relançando apenas erro terminal — verificado pelo teste novo em `apps/api/src/services/assistantHarness.test.ts`
- [x] 1.3 Preservar a mensagem 4xx do domínio em `recoverableToolError` em vez do texto genérico por status — verificado pela asserção de `code`/`message` no teste novo do harness
- [x] 1.4 Tratar `REJECTED` em `executeAssistantRun`: injetar `function_call_output` com o motivo e não registrar a operação em `completedMutationSignatures` — verificado por `bun test --isolate apps/api/src/services/assistantHarness.test.ts`

## 2. Erro determinístico não é perda de worker

- [x] 2.1 Classificar erro determinístico da run no `AgentWorker` e finalizar a run `FAILED` com o código real via `finishRunFenced` — verificado pelo teste "erro determinístico da run não vira WORKER_LOST" em `apps/api/src/services/agentJobQueue.test.ts`
- [x] 2.2 Garantir que falha transitória continua elegível a retry com backoff — verificado pelo teste "erro transitório do worker continua elegível a recuperação" no mesmo arquivo
- [x] 2.3 Manter `LEASE_LOST` e falhas de infraestrutura fora da classificação determinística — verificado por inspeção do conjunto fechado de códigos e pelos testes de fence existentes (`release de proprietário substituído não repõe a run`)

## 3. Evento de decisão único

- [x] 3.1 Remover o `APPROVAL_DECIDED` duplicado da rota de aprovação, mantendo a emissão única em `harness.approve` — verificado pelo teste "persiste eventos/tool calls" em `apps/api/src/advanced-agent.test.ts`, que exige o evento após `approve` + `executeApproved`

## 4. Verificação integrada

- [x] 4.1 Confirmar a causa raiz contra a API local: `PATCH /items/:id/move` de card com subtarefas responde `HTTP 422` com a mensagem do domínio e o card permanece na coluna original
- [x] 4.2 Rodar a suíte completa: `bun test --isolate` sem falhas (1821 pass, 32 skip, 0 fail)
- [x] 4.3 Rodar `bun run lint`, `bun run check:persistence`, `bun run check:api-boundary` e `bun run build` sem erros

## Workflow follow-up

- Arquivar a change após o sync das delta specs para `openspec/specs/azy-agent-harness/` e `openspec/specs/agent-job-queue/`.
- Conferir o resultado arquivado em `openspec/changes/archive/`.
- Publicar o commit da correção conforme o fluxo de deploy do projeto.
