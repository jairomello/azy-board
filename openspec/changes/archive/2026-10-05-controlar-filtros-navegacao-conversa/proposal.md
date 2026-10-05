## Why

O Azy Agent hoje consegue ler o contexto do board (fotografia da tela, entregue no card T16), mas **não consegue mudar o que o usuário vê**: um pedido como “mostre meus bugs sem versão” só produz uma resposta em texto, sem aplicar filtro, alternar Kanban/árvore, abrir um card ou voltar à visão anterior. O estado de visão/filtros do board vive apenas no `useState` do `BoardScreen` e é persistido em `localStorage` **compartilhado entre abas**, então não existe um contrato tipado de comandos de interface nem isolamento por aba. O card **T17 — Controlar filtros e navegação pela conversa** é a etapa 2 (P0, contexto/fluxo) da evolução do agente: a conversa passa a operar a visualização de forma verificável.

**Board ref:** `b175146b-1a42-4f31-9d67-492d04bcb7fb` (T17 - Controlar filtros e navegação pela conversa, coluna "Backlog").

## What Changes

- **Contrato tipado de comando de interface** (versionado, em `packages/assistant-contracts`): operações explícitas — aplicar/substituir filtros, limpar filtros, definir modo de visualização (Kanban/árvore) e módulo ativo, abrir um item e **voltar à visão anterior**. Cada comando carrega um identificador, o alvo e um resultado de sucesso/erro.
- **Superfície do agente por ferramentas somente-leitura**: novas ferramentas de UI (ex.: `set_board_filters`, `set_board_view`, `open_item`, `restore_previous_view`) entram no catálogo compartilhado como `operation: 'read'` em um domínio/namespace de UI — **sem aprovação** (não mutam dados) e sem chamar a API de dados.
- **Entrega pelo canal de execução existente**: o comando normalizado viaja no payload do evento `TOOL_COMPLETED` do run (sem novo tipo de evento nem migração de enum), já consumido pelo `AzyAgentDrawer`; o comando é aplicado **apenas na aba que iniciou o pedido**.
- **Store de visão por aba** (`sessionStorage`, não `localStorage`): filtros, modo Kanban/árvore, módulo ativo, item aberto e a **pilha de histórico** da visão, isolados por aba do navegador. O `BoardScreen`/`TreeViewPage` assina o store e aplica as mudanças com a mesma semântica do toolbar (incluindo o operador de ausência de valor).
- **“Voltar à visão anterior”**: histórico limitado por aba; restaurar a visão anterior não cruza projetos nem abas e não depende do histórico do navegador.
- **Confirmação no chat**: após aplicar, o agente confirma o recorte resultante (reutilizando os rótulos de escopo de T16), e falha/invalidez produz mensagem acionável sem alterar a tela.
- **Isolamento por aba vs. preferência durável**: o estado aplicado pelo agente é uma **camada de sessão por aba** (overlay) que vence a preferência persistida e **não vaza** para outras abas; a persistência durável de preferências do usuário permanece.
- **Sem BREAKING**: clientes/agentes que não usam comandos de UI continuam funcionando; o campo novo no evento é aditivo.

**Fora de escopo:** foco de modais/abas e “este card” (T19), métricas oficiais (T20), automação genérica de navegador, mutação de dados pela conversa (já coberta por T16) e novas rotas de aplicação.

## Capabilities

### New Capabilities

- `agent-ui-commands`: contrato tipado de comandos de interface emitidos pela conversa (aplicar/limpar filtros, alternar Kanban/árvore, módulo ativo, abrir card, voltar à visão anterior), transporte pelo canal de execução, store de visão por aba com histórico, confirmação no chat e limites/segurança.

### Modified Capabilities

- `azy-agent-chat`: o evento de conclusão de ferramenta do run passa a transportar o comando de interface normalizado e o cliente passa a aplicá-lo na aba de origem, alterando o contrato de eventos do chat.
- `board-filters-persistence`: filtros/visão ganham uma camada de sessão por aba para o estado aplicado pelo agente; a preferência durável continua em `localStorage`, mas o overlay de sessão prevalece e MUST NOT vazar para outras abas.

## Impact

- **Contratos compartilhados**: `packages/assistant-contracts/src/index.ts` (`AssistantViewCommand` e união de comandos) e `packages/tool-registry/src/{fields.ts,registry.ts}` (ferramentas de UI, domínio/namespace e campos).
- **API**: `apps/api/src/services/assistantHarness.ts` (normalização do comando antes de `executeTool` e payload do evento), `apps/api/src/validation.ts` (validação do comando) e `apps/api/src/services/assistantRunExecutor.ts`/`workerContext.ts` quando aplicável.
- **Web**: novo store de visão por aba (`apps/web/src/lib` ou `features/board`), `apps/web/src/features/board/BoardScreen.tsx` e `apps/web/src/pages/TreeViewPage.tsx` (assinatura/aplicação), `apps/web/src/components/AzyAgentDrawer.tsx` (dispatch do comando do evento), `apps/web/src/contexts/AssistantContext.tsx` e `apps/web/src/components/AppShell.tsx` se necessário para expor o store.
- **Persistência/isolamento**: `apps/web/src/features/board/hooks/useBoardPreferences.ts` (separar preferência durável de overlay de sessão) e `apps/web/src/lib/sessionPreferences.ts` (padrão de `sessionStorage`).
- **i18n**: `apps/web/src/i18n/locales/{pt-BR,en,es}/assistant.json` (rótulos de confirmação/erro dos comandos).
- **Testes**: `apps/web/src/assistant-ui-contract.test.ts`, `assistant-screen-context.test.ts`, novo teste de contrato do store/comandos, `apps/api/src/services/assistantHarness.test.ts`, `apps/api/src/assistant.test.ts` e verificação `bun run check`/`test:smoke`/`check:bundle` (chunk do board).
