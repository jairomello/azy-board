## Why

O Azy Agent (T16/T17/T18) já recebe a fotografia da tela e controla filtros/navegação, mas **não sabe qual é o alvo em primeiro plano**: a fotografia carrega `focus` fixo (`modalStack: 0`, `activeItemId: null`, `activeTab: null`) e o servidor resolve "este card" apenas pelo `itemId` da mensagem — que aponta para a modal principal, não para a subtarefa aberta sobre ela. Pedidos como "mude o prazo **deste** card" (com uma subtarefa aberta), "adicione validar rollback **nesta** lista" (aba Checklists) ou "corrija **este** apontamento" (aba Atividade) não têm alvo operacional. O card **T19 — Resolver o card, a modal e a aba em foco** é a etapa 2 (P0, contexto/fluxo) da evolução do agente: "aqui", "este" e a aba ativa passam a ter significado resolvido no servidor.

**Board ref:** `ff23c795-5d92-4218-bdac-0ed3484a5568` (T19 - Resolver o card, a modal e a aba em foco, coluna "Backlog").

## What Changes

- **Foco rico na fotografia da tela**: o `focus` do `AssistantScreenSnapshot` passa a carregar a **pilha de modais** (ordenada, cada nível com item e tipo), o **item em primeiro plano**, a **aba/área ativa** do item (details, subtasks, checklists, links, attachments, activity) e o **objeto interno selecionado** (checklist/etapa, link, apontamento de trabalho), além de `hasUnsavedChanges`.
- **Publicação do foco pelas modais**: `ItemModal` publica `childStack` + `activeArea`; os controles internos (checklist, links, work log) publicam o objeto selecionado. Desmontar uma modal restaura o foco anterior (pilha).
- **Resolução de "este card" pela modal da frente**: o alvo padrão passa a ser o item do topo da pilha (a subtarefa aberta sobre o pai), não a modal principal.
- **Resolução de aba e objeto interno**: pedidos que dependem da aba ativa (ex.: "nesta lista", "este apontamento") recebem o `activeEntity` quando houver seleção explícita.
- **Perguntar em ambiguidade real**: quando mais de uma checklist/registro puder ser o alvo, o agente faz uma pergunta curta em vez de escolher arbitrariamente o primeiro/último.
- **Foco no contexto autoritativo do modelo**: `focus` deixa de ser descartado pelo `compactScreenSnapshot` e passa a integrar o contexto formatado para o modelo.
- **Segurança**: IDs e seleções da tela são **referências a validar**; o servidor valida projeto/acesso antes de qualquer uso.
- **Sem BREAKING**: `focus` ganha campos; a fotografia segue opcional e clientes sem foco continuam funcionando.

## Capabilities

### New Capabilities

- `agent-focus-resolution`: publicação do foco (pilha de modais, item em primeiro plano, aba ativa e objeto interno selecionado) e a resolução operacional de "este card"/"aqui"/"nesta lista"/"este registro", com pergunta em ambiguidade e validação de acesso.

### Modified Capabilities

- `agent-screen-context`: o `focus` da fotografia da tela passa a representar a pilha de modais, o item em primeiro plano, a aba ativa e o objeto interno selecionado, e passa a integrar o contexto autoritativo do modelo (deixa de ser fixo/descartado).

## Impact

- **Contratos**: `packages/assistant-contracts/src/index.ts` (`AssistantScreenSnapshot.focus` enriquecido) e possivelmente `packages/ui-contracts` (tipo de área do item/objeto interno compartilhado).
- **Web**: `apps/web/src/contexts/AssistantContext.tsx` (foco no `pageContext`), `apps/web/src/components/AppShell.tsx` (publicação), `apps/web/src/features/board/BoardScreen.tsx` (item em primeiro plano = topo da pilha de modais), `apps/web/src/components/ItemModal.tsx` (`childStack`/`activeArea`), `ChecklistSection`/`ItemLinksArea`/`WorkLogPanel`/`ActivityLogPanel` (objeto selecionado), `apps/web/src/lib/assistantSnapshot.ts` (`focus` no builder) e `apps/web/src/components/AzyAgentDrawer.tsx` (envio).
- **API**: `apps/api/src/validation.ts` (`assistantScreenSnapshotSchema.focus` strict com os novos campos), `apps/api/src/routes/assistant.ts` (`compactScreenSnapshot`/`formatAssistantPromptContext` incluem `focus`; `resolveSelectedItem` usa `focus.activeItemId`) e eventual resolvedor de objeto interno no harness.
- **i18n**: `apps/web/src/i18n/locales/{pt-BR,en,es}/assistant.json` (pergunta de ambiguidade).
- **Testes**: contrato do snapshot com foco, resolução do item em primeiro plano (subtarefa sobre o pai), aba/objeto interno, ambiguidade e verificação `bun run check` / `bun run test:smoke`.
- **Fora de escopo**: as ferramentas de CRUD de checklist/link/apontamento (T21/T22), métricas (T20), comandos de interface (T17, já entregues) e automação genérica de navegador.
