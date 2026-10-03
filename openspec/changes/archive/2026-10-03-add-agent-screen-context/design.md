## Context

O contexto publicado hoje pelo frontend (`AssistantPageContext` em `apps/web/src/contexts/AssistantContext.tsx:26-33`) contém tela, projeto (id/nome), item da modal em primeiro plano, modo de board e um espelho parcial dos filtros (`BoardScreen.tsx:923-926`), mas o envio (`AzyAgentDrawer.tsx:287-292`) não transporta filtros nem a população apresentada. O servidor resolve usuário/projeto/item autoritativamente (`routes/assistant.ts:155-182`, `formatAssistantPromptContext`) e não sabe o resultado exibido nem a aba ativa. A mutação em lote (`update_items` → `routes/batch.ts:36-293`) re-aplica filtros set-based no servidor, o que permite ampliação de escopo; a prévia (`approvalPreview` em `services/assistantHarness.ts:477-484`) é apenas descritiva. Concorrência existe hoje só no PATCH individual (`expectedUpdatedAt`, `PERSISTENCE_CONFLICT`).

Análise base: `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md` (seções 3, 4 e 7). Restrições do tenant (isolamento por `tenant_id`), RBAC de mutação, dados não confiáveis no prompt/canais e fila persistente (`agent-job-queue`) inspiram as decisões.

Board ref: `878fe024-3027-4d6e-a38c-b7d09ba17618` (card T16).

## Goals / Non-Goals

**Goals:**
- Compartilhar com o agente a fotografia fiel da tela no envio do pedido (tela, projeto, visualização, filtros, população exibida).
- Fixar essa fotografia na execução e na aprovação — o escopo não muda se o usuário navegar ou refiltrar.
- Aplicar sprint e versão (e campos já suportados) somente aos IDs capturados, com o servidor impondo o escopo.
- Prévia com quantidade e alterações por card; conflito concorrente visível; resultado vazio explicado.
- Semântica documentada e testada para aba de módulo, grupos recolhidos, árvore, paginação e virtualização.

**Non-Goals:**
- Seleção múltipla de cards na UI (não existe; escopo para entrega futura).
- Resolução de "este card" por pilha de modais/até vos internos (card T19).
- Comandos de navegação/filtros pelo chat (card T17).
- Consultas estruturadas novas com operadores tipados em escala (card T26).
- Snapshot persistido como catálogo versionado de "visões salvas".

## Decisions

### 1. Contrato versionado do snapshot em `packages/assistant-contracts`
Novo tipo `AssistantScreenSnapshot` (schemaVersion 1) com `contextId`, `capturedAt`, `route`, `screen` (enum existente), `projectId`, `projectName`, `view { mode, activeModuleId, collapsedGroupIds }`, `filters` (espelho fiel, com ausência expressa por operador, não pelo sentinela da UI), o `scope { mode: 'ALL' | 'FILTERED' }` (que determina se IDs viajam) e `results { displayedItemIds?, displayedCount, totalMatchingCount, isComplete, revisions }`. `focus` entra como sinais mínimos (pilhas de modal e não-salvo podem evoluir no T19). O transporte é um campo `context` **opcional** em `assistantMessageSchema` e `assistantAdjustSchema` (ambos `.strict()` — exigem acréscimo explícito). Alternativas descartadas: campo `snapshot` separado da mensagem (duplica semântica) ou reutilizar `filters` do `update_items` como transporte (o snapshot descreve a tela, não a mutação).

### 2. Captura derivada do estado de apresentação, com modo de escopo
BoardScreen e TreeViewPage derivam a fotografia com `useMemo` do **mesmo estado que determina o conteúdo** e a publicam via `AssistantContext` (AppShell repassa), capturada pelo drawer no clique de envio. Regras: cards reais com ação (TASK/BUG) formam o conjunto; histórias virtuais e IDs de agrupamento (módulo/épico/história como agrupador, tabs) nunca entram como IDs persistidos; grupos recolhidos continuam no resultado (recolhimento é apresentação, não filtro). O snapshot declara o **modo de escopo**: sem nenhum filtro aplicado (`scope: 'ALL'`), não envia IDs — o que está na tela é a população inteira do projeto e basta saber que a ação vale para tudo; com filtro aplicado (`scope: 'FILTERED'`), envia os IDs do resultado — limitados, com truncamento explícito e, acima do limite, referência a snapshot persistido no servidor. Alternativas descartadas: enviar `allItems`/interseção do board (inclui população não apresentada) e enviar a lista de IDs incondicionalmente (infla a janela em projetos com milhares de tickets).

### 3. Revisões por item capturadas na própria fotografia
`results.revisions` (`itemId → updatedAt`) é preenchido no momento da captura (dados já presentes nos cards). A rota de lote compara o `updated_at` corrente de cada item no momento da execução; divergência → `CONCURRENT_WRITE` (409) listando divergentes, e o chat recalcula a prévia (nova prévia, novo hash) sem ampliar população. Alternativa descartada: revisão única por projeto (fraca) e `expectedUpdatedAt` único para o conjunto (perde itens afetados).

### 4. Escopo travado imposto pelo servidor (`canonicalArguments`)
Com snapshot presente, o servidor aplica a mutação conforme o modo de escopo: em `scope: 'ALL'` (nenhum filtro aplicado), mantém o `matchAll: true` já imposto pelo harness com a população resolvida server-side (sem lista de IDs no args); em `scope: 'FILTERED'`, reescreve os args de `update_items` para `filters = { itemIds: capturados, matchAll: false }` (removendo filtros que ampliem). Em ambos, o estretamento de tipos já imposto (`itemTypeScope`) permanece. `matchAll: true` sem fotografia de escopo completo e qualquer re-filtragem que busque população além da fotografia são bloqueados nessa trajetória; os args persistidos (`argumentsJson`) e o hash da operação são a fonte de verdade na aprovação e na retomada do worker. A resolução de sprint/versão (`CURRENT`, catálogo do projeto, sprint fechada) permanece na rota existente. Alternativas descartadas: apenas instrução ao modelo (o prompt não é autoritativo) e nova ferramenta dedicada (redundante com `update_items`).

### 5. Prévia real e compacta (`approvalPreview`)
`approvalPreview` para `update_items` com escopo travado passa a resolver a população no servidor: `displayedCount`, `matchedCount`, contagem de alterações por campo e um resumo por item limitado (lista completa disponível por consulta/toolbar do drawer). Excesso de limite é declarado explicitamente (sem truncamento silencioso) conforme os limites do harness. Alternativa descartada: manter descrição textual sem contagem (o requisito da entrega é exatamente a quantidade).

### 6. Fixação na execução enfileirada
A fotografia validada entra no `executionState` do run (`executionContextJson`) e um `contextId`/hash resumido vai no `metadataJson` da mensagem; o worker reidrata via `loadRunContext` e `executeApproved` re-verifica o hash — a retomada da fila usa o mesmo snapshot. Navegar depois do envio não altera o escopo (cenario de aceitação 3).

### 7. Segurança: IDs são referências, nunca permissões
O servidor valida `projectId` vs. conversa (`CONVERSATION_PROJECT_MISMATCH`), acesso ao projeto, tipo/scope efetivo do autor e cada ID contra tenant/projeto; payload não contém capacidades. Textos e títulos dos cards seguem sendo dados não confiáveis. Snapshot manipulado (screen incompatible, IDs de outro projeto) fará o servidor recalcular/validar e rejeitar antes da mutação, sem conceder acesso.

## Risks / Trade-offs

- **Payload da fotografia em projetos grandes** → sem filtro nenhum a fotografia não envia IDs (`scope: 'ALL'`); com filtro, IDs limitadas e, acima do limite, referência a snapshot persistido no servidor; prévia resumida.
- **Captura acoplada às telas (Kanban/árvore)** → derivação centralizada por visualização (fonte única de apresentação) + testes de contrato; restantes das telas entram nas etapas seguintes.
- **Concorrência gera fricção (conflito comum)** → recálculo de prévia explícito no chat; conflito só em campos relevantes (revisão do item).
- **Modelo pode tentar ampliar escopo no prompt** → o servidor impõe o escopo travado independente do comportamento do modelo.
- **Evals atuais de bulk-move** precisam considerar contexto/snapshot sintético → datasets atualizados no mesmo ciclo.
- **Custo do prompt maior com o contexto** → campo compacto; o enriquecimento (`totalMatchingCount`) é calculado server-side sem duplicar lista completa.

## Migration Plan

1. Contrato: tipo do snapshot + constantes em `packages/assistant-contracts` (reexport em `packages/types`).
2. Web: captura por visualização (Board/árvore) + publicação no contexto + transporte no drawer (send/adjust).
3. API: validação, captura/validação server-side e fixação no run (prompt autoritativo).
4. Harness/executor: escopo travado em `canonicalArguments`, prévia com contagem, conflito/vazio/paginação na rota de lote.
5. Testes de unidade/integração/contractos/e2e + guardas (`check:frontend-tests`, `check:bundle`), evals ajustados.
6. Sem migração de banco necessária nesta entrega (o snapshot viaja no JSON existente de mensagem/contexto).

**Rollback**: campos opcionais; remover o transporte e o branch travado não afeta dados. Fila enfileirada com snapshot antigo é descartada como hoje (tool call pendente).

## Open Questions

- Idioma do escopo interpretado no chat (“Resultado atual · N cards”) — labels e i18n a definir na implementação.
- Semântica exata quando a população do board é virtualizada (hoje não há; regra já documentada para a etapa futura).
- Prioridade entre aplicar sprint e versão em um único lote vs. operações separadas por campo (composição na prévia).
