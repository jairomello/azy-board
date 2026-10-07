Board ref: 5a92afc0-d02d-4dbe-9852-b931cb81ecb2

## Context

`assistantTools.ts` importa execução e tipos do app MCP. `registry.ts` valida/coerce argumentos, resolve nomes de projeto, revalida autorização e despacha para `tools.ts` usando `ApiCall`; também injeta revisões da fotografia. `packages/tool-registry` já contém definições/policies puras e sua spec proíbe transporte. `apps/api/src/persistence/{ports,models,context,runtime}.ts` oferece fronteira independente de dialect, mas ainda há orquestração em `routes/{items,batch,assistant,projects}.ts`. A análise atualizada e a proposta delimitam a extração residual; não há justificativa para reescrever todo CRUD.

## Goals / Non-Goals

**Goals:** API compilável/executável sem `apps/mcp`; execução única com contratos estáveis; autorização e transação observáveis em testes dos casos críticos, nos dois perfis.

**Non-Goals:** novo catálogo, novos endpoints, troca de autenticação, migração de instalação, adapters ADVANCED (T36), isolamento do worker/fencing (T37), criação de outbox/idempotência (T38) ou barramento (T39).

## Decisions

### Separar definições, execução e adaptadores

Recomenda-se `packages/tool-execution` (novo) para normalização, resolução, dispatch e sanitização, dependente de `tool-registry` e contratos, sem Hono, SDK MCP, driver ou acesso a ambiente. Receber um port de invocação tipado e contexto confiável por composição. Extrair os mapeamentos hoje em `tools.ts` para adaptador HTTP compartilhado ou camada interna do novo pacote, sem importar o app MCP. MCP fica responsável pelo protocolo e credencial HTTP; a API injeta invocação local. Alternativa de pôr transporte no `tool-registry` viola sua spec; copiar dispatch duplica regras.

### Aplicação local para casos críticos

Recomenda-se `apps/api/src/application/{items,batch,agent}` (novos módulos) com funções pequenas, comandos e DTOs explícitos. Rotas convertem request/response, middleware resolve identidade e aplicação autoriza por membership/escopos no instante do uso. Criar/editar/mover item, batch de criação/atualização/movimentação e invocação de ferramenta do agente convergem para esses casos. Ferramentas não críticas podem temporariamente usar adaptador HTTP local, com inventário explícito; nenhuma regra crítica fica no adaptador. Não substituir validação de domínio por apenas JSON schema.

### Usar a unidade transacional estabelecida em T38

Casos de uso recebem port de unidade de trabalho e ports restritos ao tenant/ator. Na mesma unidade: autorização sensível à concorrência, mutação, revisão, resultado idempotente, auditoria/analytics e evento durável. Falha impede commit; emissão de rede fica depois do commit pelo contrato de T38/T39. Reutilizar as operações atômicas já extraídas por T36/T38 e mover somente sua orquestração. T37 entrega token de posse; caso do agente valida esse token antes de efeitos. Não aceitar tenant, owner ou geração vindos do modelo. Alternativa de transacionar só no handler permite execução interna sem a mesma garantia.

### Compatibilidade comprovada por contrato

Manter nomes, coerção null/string, duração, nome exato/UUID de projeto, limites, sanitização, `PROJECT_CONTEXT_MISMATCH`, autorização obrigatória do agente e revisões de snapshot. Testar REST, MCP via HTTP e agente local para resultados/erros equivalentes, normalizando somente IDs/relógio controlados. Gate estrutural de dependências é adequado para fronteira de imports; resultado de negócio exige testes comportamentais. Build isolado usa staging descartável sem fontes MCP, não remove arquivos do workspace.

### Inventário confirmado antes da extração (2026-10-07)

| Fronteira atual | Responsabilidade observada | Destino/ownership |
| --- | --- | --- |
| `packages/tool-registry` | Definições, schemas, coerção/validação e policies puros | Continua como catálogo; sem dispatch/transporte |
| `apps/mcp/src/registry.ts` (removido após migração) | Normalização, duração, resolução de projeto/entidades, verificação de contexto, autorização e dispatch de ferramentas | Implementação agora em `packages/tool-execution/src/registry.ts` |
| `apps/mcp/src/tools.ts` (removido após migração) | Mapeamento de ferramentas para rotas REST por `ApiCall`; inclui compactação de respostas e delegação de batch | Adaptador HTTP compartilhado em `packages/tool-execution/src/http-adapter.ts`; protocolo/credencial permanecem no app MCP |
| `apps/api/src/services/assistantTools.ts` e `routes/assistant.ts` | Reexporta execução compartilhada; roteamento, autorização e contexto da conversa/fotografia do agente | API importa o pacote de execução e compõe aplicações críticas |
| `apps/api/src/services/assistantRunExecutor.ts`, `assistantHarness.ts`, `workerContext.ts` | Executa tools após enfileiramento; o worker reconstitui tenant/usuário/contexto e chama API local; T37 fornece generation/signal/fencing | Adaptador local compõe o caso de uso e transmite posse autenticada; worker/fencing continuam sob ownership T37 |
| `apps/api/src/routes/items.ts` | POST de criação (linha 478), PATCH de movimento (681) e edição (792), incluindo validações, relações, revisão e resposta | Casos de uso de criação/edição/movimento; rota reduzida a autenticação/HTTP |
| `apps/api/src/routes/batch.ts` | POST de atualização filtrada (40), criação batch (329), resolução/validação e adaptação a `persistence.unitOfWork` | Casos batch compartilhados; unidade transacional existente permanece com T36/T38 |
| `apps/api/src/persistence/{ports,runtime.ts}` e adapters | Persistência tenant-scoped e `unitOfWork` para mutações, idempotência e eventos duráveis (T36/T38); dispatcher/outbox distribui após commit (T39) | Reusar; não duplicar unidade de trabalho, adapters, fencing ou publicação |
| Testes REST/regressão | Testavam compatibilidade dos adapters HTTP antes da extração | Agora importam `@azy-board/tool-execution`; sem dependência de fontes MCP |

Fallback inicialmente via adaptador HTTP: leitura/listagem/descoberta (`list_*`, board/tree/snapshot/métricas), planejamento e catálogo (`projects`, módulos, sprints, versões, tags, squads, membros, centros de custo), checklists, logs, links e anexos, além de operações não classificadas como criação/edição/movimentação item, batch ou execução local do agente. Reavaliar qualquer operação mutável do catálogo durante a extração para manter autorização REST server-side; fallback não autoriza bypass do contexto do projeto.

### Contratos estabilizados reutilizados (T36–T39)

- **T36 (persistência/perfil):** `PersistenceContext` carrega `tenantId`, ator e grupo; `MutationContext` acrescenta metadados imutáveis da mutação. `PersistencePorts` é composto em `persistence/runtime.ts`; SQLite e PostgreSQL implementam os mesmos ports. A aplicação deve consumir esses contratos, sem importar Drizzle/SQL nem criar adapter paralelo.
- **T38 (unidade transacional):** `persistence.unitOfWork` já expõe `createItemWithRelations`, `updateItemWithRelations`, `moveItem`, `applyItemBatch` e `createItemsBatch`. `MutationContext` transporta `idempotency` e `domainEvents`; o adapter efetiva journal, mutação, auditoria e outbox no mesmo commit. Caso de uso coordena e chama uma unidade, não reproduz journal/outbox nem faz commit próprio.
- **T37 (fencing):** `AgentPort` exige `workerId` e `generation` em heartbeat, release e writes/finalização fenced. `AgentWorker` entrega `generation` e `AbortSignal` ao executor; `assistantHarness`/`assistantRunExecutor` guardam gravações. O caso de agente precisa receber essa posse internamente, nunca de argumentos do modelo.
- **T39 (publicação):** `domainEvents` são confirmados pela unidade transacional; `domainEventDispatcher` reivindica/entrega a outbox após commit, com retry/ordenação/telemetria. Os casos de uso não publicam diretamente nem esperam o broker dentro da transação.

Ownership para esta extração: T40 é dono de `packages/tool-execution`, adaptadores de dispatch e orquestração de casos críticos. T36 continua dono dos adapters de persistência/perfil; T37 do lifecycle/fencing do worker; T38 do journal/idempotência e gravação transacional da outbox; T39 do dispatcher, entrega distribuída e reconciliação realtime. T40 só integra esses contratos e pode acrescentar ports de aplicação estritamente necessários.

### Execução do agente e revalidação no último limite

`assistantRunExecutor` importa `executeSharedTool` por `assistantTools.ts` → `@azy-board/tool-execution`, injeta `createWorkerToolApi` e `authorizeAssistantTool`, e verifica `AbortSignal` antes de cada dispatch. O worker adapter assina uma sessão interna para o usuário/run e chama `app.fetch` dentro do mesmo processo; não importa `apps/mcp`. Assim, uma revogação entre autorização da tool e dispatch é revalidada pelo middleware RBAC compartilhado com os casos de uso, antes de tocar a UoW. Aprovação continua no harness; snapshot/revisões continuam sendo injetados pelo dispatcher compartilhado; estado da run/checkpoints permanece fenced por T37. `agentJobQueue.test.ts` cobre a revogação entre a autorização da tool e a chamada interna. Esse caminho preserva a API como adaptador local temporário do agente enquanto os casos de uso crescem, sem duplicar validação/idempotência.

### Evidências reutilizadas na matriz de contrato

- SQLite/SIMPLE: `apps/api/src/integration.test.ts` cobre rollback atômico, replay T38, revisão divergente, escopo cross-tenant, criação/edição/movimento e batch; `apps/api/src/regression.e2e.test.ts` compara os adapters com REST; MCP tem suite de registry/adaptadores em `apps/mcp/src`.
- Worker/T37: `apps/api/src/services/agentJobQueue.test.ts` cobre geração obsoleta, abort, retry e revogação de membership; `assistantHarness.test.ts` cobre `LEASE_LOST` em escritas da run.
- ADVANCED/PostgreSQL + Valkey: matriz executada em banco descartável `azyboard_t40_matrix_20261007` e Valkey efêmero: `advanced-http.test.ts` (12), `advanced-worker-fence.test.ts` (1), `advanced-agent.test.ts` (1), `advanced-realtime.test.ts` (7) e `advanced-rollout.test.ts` (2), todos verdes; recursos temporários removidos após o uso.
- Gates finais: `bun run check` e `bun run test:smoke` verdes; `bun run test:mcp-catalog`, `bun run check:docs` e `bun run check:api-boundary` verdes.

## Risks / Trade-offs

- [Autorização esquecida ao abandonar HTTP] → contexto autenticado e port de autorização obrigatório; revogar membership entre descoberta e execução em teste.
- [Transações aninhadas ou fragmentadas] → uma unidade de trabalho por comando; adapters não fazem commits paralelos fora dela.
- [Mudanças concorrentes T36/T38] → integrar contratos após estabilização e revisar ownership antes de mover funções; não criar segundo sistema transacional.
- [Ciclo de imports e efeitos no boot] → composição só no runtime; pacote compartilhado sem imports de apps; teste isolado em ambos os perfis.
- [Deriva no catálogo extenso] → matriz de ferramentas/mapeamentos e testes de compatibilidade antes de retirar reexports.

## Migration Plan

1. Estabilizar ports de T36/T38 e contexto de T37; inventariar executores.
2. Extrair pacote mantendo fachada MCP compatível; migrar testes e API para o pacote.
3. Extrair um caso crítico por vez e trocar invocação do agente para local, sem duas mutações para comparação.
4. Comparar respostas/efeitos em ambientes descartáveis; retirar import legado só com gate isolado verde.
5. Rollback de T40 por versão de aplicação/lockfile anterior que contenha `apps/mcp/src/registry.ts` e `tools.ts`; a extração não altera schema, portanto não requer downgrade de banco. Só manter essa volta se também for compatível com T36/T38 já implantados; nunca remover journal/outbox nem republicar eventos confirmados. As fachadas temporárias foram removidas após build, suite MCP e contrato API verdes.

## Open Questions

Sem dúvida bloqueante de produto. Os nomes finais dos ports devem seguir os contratos entregues por T36/T38, preservando as responsabilidades acima. Metas de redução de linhas não são critério de aceite.
