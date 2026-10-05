## Why

É comum um card “sumir” do board sem o usuário entender o motivo: um filtro aplicado, a aba de um módulo, um grupo recolhido, a regra que esconde subtarefas, uma história/épico vazio ou o arquivamento. Hoje o Azy Agent (T16/T17) enxerga a fotografia da tela e até controla filtros e navegação, mas **não responde “por que a tarefa T42 não está aqui?” com a causa comprovada** nem oferece “mostrar esse card” preservando a visão anterior. A lógica de visibilidade está embutida no `useMemo` de `boardCards` em `BoardScreen.tsx` e não é compartilhada com o agente. O card **T18 — Explicar por que um card não aparece no board** é a oportunidade #2 (P1, contexto/fluxo) da evolução do Azy Agent.

**Board ref:** `260522e1-21ac-44fc-8f3c-f7be2b4756bb` (T18 - Explicar por que um card não aparece no board, coluna "Backlog").

## What Changes

- **Avaliador compartilhado de visibilidade** (fonte única entre interface e agente): dado um item e o estado de visão corrente, retorna `visible` + lista ordenada de **motivos tipados** — `ARCHIVED`, `FILTER` (com o campo e o valor que excluiu), `MODULE_TAB`, `COLLAPSED_GROUP`, `SUBTASK_HIDDEN` (regra de folha), `EMPTY_GROUP_HIDDEN`, `ACCESS_DENIED`. Nunca infere exclusão apenas por ausência na lista.
- **Explicação na conversa**: para “por que o card X não aparece?”, o agente resolve o item (por ID ou `sequenceCode`), avalia com a fotografia da tela e responde a causa comprovada, com motivos em linguagem natural e i18n (PT-BR/EN/ES).
- **Oferta de exibição preservando a visão anterior**: um comando revela o item neutralizando os motivos responsáveis (trocar a aba de módulo, expandir o grupo, desligar o filtro/regra de apresentação), registra um checkpoint e abre o item; `restore_previous_view` (T17) restaura a visão anterior.
- **Estado de apresentação na fotografia**: a `AssistantScreenSnapshot` passa a carregar `showSubtasks` (regra de folha/subtarefas), `storyDisplay`, `moduleViewMode`, `hideEmptyEpics` e `hideEmptyStories`, necessários para explicar “regras da visão” (hoje só filtros de população viajam).
- **Superfície do agente somente-leitura**: nova ferramenta de UI `explain_item_visibility` (não muta dados, sem aprovação, fora do catálogo MCP) e novo comando de visão `reveal_item`.
- **Respeito ao acesso ao projeto**: a explicação valida acesso ao item/projeto antes de revelar conteúdo; IDs e filtros da tela são referências a validar, nunca permissões.
- **Sem BREAKING**: campos e comandos novos são aditivos; clientes sem fotografia/estado de apresentação degradam para “não foi possível determinar o motivo”.

## Capabilities

### New Capabilities

- `card-visibility-explanation`: avaliador compartilhado de visibilidade, taxonomia de motivos tipados, explicação da causa no chat, oferta de revelação do item preservando a visão anterior, guarda de acesso ao projeto e i18n.

### Modified Capabilities

- `agent-screen-context`: a fotografia da tela ganha o **estado de apresentação** (regra de folha/subtarefas, exibição de histórias, modo de módulos e ocultação de grupos vazios) além dos filtros de população, para embasar a explicação.
- `agent-ui-commands`: a superfície do agente passa a incluir a explicação somente-leitura (`explain_item_visibility`) e o comando `reveal_item`, aplicado na aba de origem com checkpoint para `restore_previous_view`.

## Impact

- **Compartilhado**: novo módulo de visibilidade em `packages/ui-contracts/src/` (tipo `ItemVisibilityReason`, `evaluateItemVisibility`) reexportado pelo barrel; `packages/assistant-contracts/src/index.ts` (estado de apresentação no snapshot e novo tipo de comando `reveal_item`).
- **Web**: `apps/web/src/features/board/BoardScreen.tsx` (reutilizar o avaliador em `boardCards`/grupos em vez de predicados inline), `apps/web/src/features/board/model/types.ts` e `filter-predicates.test.ts`, `apps/web/src/lib/assistantSnapshot.ts` (capturar apresentação), `apps/web/src/lib/assistantViewStore.ts` (aplicar `reveal_item` + checkpoint), `apps/web/src/components/AzyAgentDrawer.tsx` (dispatch), `apps/web/src/features/board/*` para expandir grupo/aba.
- **API**: `apps/api/src/services/assistantUiTools.ts` (ferramenta `explain_item_visibility` + `reveal_item`), `apps/api/src/services/assistantHarness.ts` (prompt e roteamento do nome da ferramenta), `apps/api/src/routes/assistant.ts` (resolver item por `sequenceCode`/ID com verificação de acesso) e `apps/api/src/validation.ts` se necessário.
- **i18n**: `apps/web/src/i18n/locales/{pt-BR,en,es}/` (rótulos dos motivos e da oferta de revelação) e mensagens do harness.
- **Testes**: novo teste do avaliador (`packages/ui-contracts`), `apps/web/src/assistant-screen-context.test.ts`, teste de contrato do snapshot/comando, `apps/api/src/services/assistantUiTools.test.ts`, e verificação `bun run check` / `bun run test:smoke` / `bun run check:bundle`.
- **Fora de escopo**: foco de modais/abas e “este card” (T19), métricas oficiais (T20), automação genérica de navegador, dependências entre cards e mutação de dados.
