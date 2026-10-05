## Why

Hoje, ao criar um card no board (UI, API REST ou Azy Agent via `create_task`/`batch`), o card nasce **sem sprint**, **sem versão** e **sem ícone** — mesmo quando o projeto tem uma sprint vigente e uma versão em desenvolvimento. O usuário precisa abrir o card e preencher tudo manualmente, quebrando o fluxo contínuo; além disso, cards sem ícone ficam visualmente inconsistentes no Kanban. O card **T35 — Vincular à sprint ativa** pede que a criação aplique **defaults determinísticos**: vincular à sprint vigente, vincular à versão vigente e aplicar um ícone default.

**Board ref:** `300b8bf4-8e65-4f8a-ae5c-682f5c790430` (T35 - Vincular à sprint ativa, coluna "A Fazer").

## What Changes

- **Sprint vigente automática**: ao criar um card (TASK/BUG) **sem `sprintId` explícito**, se existir sprint `OPEN` cujo intervalo `[startDate, endDate]` contém a data atual, o card SHALL ser vinculado a ela. Havendo mais de uma candidata, usar a **mais antiga** (`createdAt`).
- **Versão vigente automática**: ao criar um card (TASK/BUG) **sem `versionId` explícito**, se existir versão com `releaseDate` **futura mais próxima** de hoje (empate → mais antiga por `createdAt`), o card SHALL ser vinculado a ela.
- **Ícone default determinístico**: ao criar um card (TASK/BUG) **sem `icon`**, o sistema SHALL persistir o ícone default de item (`file-text`, `DEFAULT_ITEM_ICON`), de modo que todo card criado tenha ícone.
- **Explicitude vence o automático**: `sprintId`/`versionId`/`icon` informados (ID ou `null`) têm precedência; o automático só age quando o campo é **omitido**.
- **Cobertura dos fluxos de criação**: criação individual (`POST /projects/:id/items`, usada pela UI e pelo MCP `create_task`) e criação em lote (`POST /projects/:id/batch`, usada pelo MCP `batch`/`create_project_structure`), respeitando projeto/tenant.
- **Escopo por tipo**: apenas TASK/BUG (cards de trabalho). EPIC/STORY não recebem os defaults automáticos.
- **Sem duplicidade / sem BREAKING**: mantém no máximo uma associação por par `(itemId, sprintId)`; nenhum campo novo — muda o comportamento padrão quando o campo é omitido.

## Capabilities

### New Capabilities

<!-- Nenhuma capability nova: a mudança estende associação a sprints, associação a versões e ícones. -->

### Modified Capabilities

- `sprint-management`: a associação de cards a sprints ganha o **vínculo automático à sprint vigente** na criação (OPEN + data atual dentro do intervalo; empate → mais antiga).
- `version-management`: a associação de itens a versões ganha o **vínculo automático à versão vigente** na criação de cards (próximo lançamento por data).
- `entity-icons`: o ícone default de item passa a ser **persistido na criação de cards** sem ícone (deixa de ser apenas um fallback de renderização para itens recém-criados).

## Impact

- **API**: `apps/api/src/routes/items.ts` (criação individual resolve sprint/versão vigentes e aplica ícone default), rota de lote `POST /projects/:id/batch` e `apps/api/src/db/sqlite/itemUnitOfWork.ts` (`createBatchItemInsideTransaction` passa a gravar `item_sprints`, `version_id` e `icon`), `apps/api/src/validation.ts` se necessário.
- **MCP**: descrições de `create_task` e `batch` em `packages/tool-registry/src/registry.ts` documentando os defaults e o escape hatch (`sprintId: null`, `versionId: null`, `icon: null`).
- **Web**: nenhuma mudança obrigatória; a criação rápida omite os campos e a resposta com relações reflete os defaults.
- **Persistência**: caminho de lote SIMPLE ganha sprint/versão/ícone; paridade PostgreSQL de `createItemsBatch` segue pendente (como em B4).
- **Testes**: criação individual e em lote (com/sem candidato, explícito e `null`), determinismo de empate e verificação `bun run check` / `bun run test:smoke`.
- **Fora de escopo**: vincular itens existentes em massa (já coberto por `update_items`), criar/ativar sprints ou versões automaticamente, e aplicar defaults a EPIC/STORY.
