# Design

## Context

Ver `proposal.md` — Why. O caminho normal do harness (`runExisting`) já classificava erros de tool em recuperáveis e terminais (`recoverableToolError`), devolvendo a mensagem ao modelo. O caminho de retomada pós-aprovação (`AssistantHarness.executeApproved`) não tinha esse tratamento: marcava a tool call como `RUNNING`, executava a ferramenta sem `try/catch` e propagava a exceção. O `AgentWorker` interpretava qualquer exceção como perda de posse e reenfileirava com backoff, consumindo o budget de recuperação até `FAILED/WORKER_LOST`.

Restrição relevante: a retomada é reconstruída do banco a cada aquisição, então qualquer decisão de estado precisa ser persistida no mesmo commit do efeito, e o fence por proprietário/geração não pode ser enfraquecido.

## Goals / Non-Goals

**Goals:**

- Toda falha recuperável de ferramenta aprovada volta ao modelo com o motivo do domínio, sem deixar a tool call em execução.
- Distinguir erro determinístico da run de perda real de posse, finalizando a run com o código real em vez de `WORKER_LOST`.
- Manter o comportamento de retry com backoff intacto para falhas transitórias.

**Non-Goals:**

- Não alterar o contrato HTTP, o schema do banco nem o fluxo de aprovação (CAS por hash).
- Não expor `isLeaf` na leitura de itens nem avisar o agente antes da aprovação — melhoria de UX fora deste escopo.
- Não reprocessar runs já finalizadas como `WORKER_LOST`.

## Decisions

**Resultado tipado em vez de exceção para recusa recuperável.** `executeApproved` passa a devolver `ApprovedExecutionOutcome` (`EXECUTED` | `REJECTED`), espelhando o contrato que o caminho normal já usa com `function_call_output`. Alternativa considerada: capturar a exceção no executor — rejeitada porque o executor não é dono do estado da tool call e a marcação `FAILED` precisa acontecer onde a posse do registro é conhecida.

**Recusa recuperável não entra em `completedMutationSignatures`.** A operação não foi aplicada; registrá-la como concluída faria uma retomada tratá-la como já executada (ou disparar `REPEATED_TOOL_CALL`). Alternativa considerada: registrar a assinatura e confiar no resultado idempotente — rejeitada por mascarar a falha em retomadas.

**Classificação explícita do erro determinístico no worker.** O worker compara a mensagem com um conjunto fechado de códigos de contrato/limite da run e finaliza `FAILED` com o código real via `finishRunFenced`. Alternativa considerada: mover a finalização para o executor — rejeitada porque o executor não conhece o contexto de posse; a decisão de retry é responsabilidade do worker.

**Preservar a mensagem 4xx do domínio.** `recoverableToolError` passa a repassar o texto que a própria API já devolve em pt-BR, em vez do genérico por status. Alternativa considerada: manter o texto genérico e enriquecer depois — rejeitada porque é exatamente o que impedia o agente de explicar o motivo real.

**Evento de decisão emitido em um só lugar.** O `APPROVAL_DECIDED` fica no `harness.approve`, que é o ponto que já centraliza o CAS; a rota deixa de duplicá-lo.

## Risks / Trade-offs

- [Falso positivo na classificação determinística (mensagem de infraestrutura igual a um código de contrato) finaliza a run em vez de recuperar] → O conjunto é fechado e ancorado no texto completo da mensagem, restrito a códigos de contrato/limite da run; `LEASE_LOST` e falhas de infraestrutura permanecem fora dele.
- [A aprovação permanece `APPROVED` após uma recusa recuperável, e uma retomada posterior encontra o bloco de aprovação já respondido] → Comportamento idêntico ao caminho de sucesso já existente; a retomada responde `APPROVAL_CONTEXT_MISSING` em vez de reexecutar, sem efeito colateral de mutação.
- [A recusa recuperável deixa de consumir budget, então um modelo que insiste na mesma operação gera novas aprovações] → Cada nova tentativa passa por aprovação humana explícita; o limite de passos/tool calls da run continua valendo.

## Migration Plan

Sem migração de dados. Deploy é a substituição do código da API; rollback é reverter o commit. Runs já terminais não são tocadas.
