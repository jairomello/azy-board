# Proposal

**Board ref:**
- T57 — `045736de-b489-4af1-ab11-ac94bba9106b` (Novos filtros)
- T58 — `849fe963-f5e4-4338-8ea1-0cf5541d255c` (Datas automáticas)

## Why

Hoje o gestor não consegue responder "o que mudou no board nos últimos N dias": os filtros atuais cobrem atributos estáticos (sprint, responsável, tag, versão…), mas não o **instante da última alteração** de cada card. Pior, o `updatedAt` do item só é atualizado quando o próprio registro muda — alterar checklist, link, anexo, dependência ou histórico de um card, ou uma subtask, não marca o card como alterado, então nenhuma janela de tempo seria confiável. Em paralelo, ao criar uma task vinculada a uma sprint, o item fica com início/fim vazios mesmo quando a sprint já tem datas, exigindo preenchimento manual e deixando o cronograma incompleto.

## What Changes

- **Marcador de última alteração do card (T57):** o `updatedAt` de um item passa a representar a última alteração **do card ou de qualquer registro dependente dele** — subtasks, passos/checklists, links externos, anexos, dependências e histórico/apontamentos. Toda mutação nesses registros atualiza o `updatedAt` do item dono e **propaga para os ancestrais** (subtask → task → story → épico) em uma única operação em lote baseada no `ancestry_path` já desnormalizado (sem recursão, sem N+1, sem loop).
- **Novo filtro por janela de alteração (T57):** o painel `Filtros` do board ganha uma dimensão "Alterados" com as opções: último dia, últimos 2, 3 e 5 dias, última semana, **sprint atual** e último mês. As janelas são calculadas em **dias-calendário no fuso do projeto** (America/Sao_Paulo). O filtro combina com os demais por AND, entra nos chips de filtros ativos, é persistido por projeto e pode ser limpo individualmente.
- **Filtro disponível para MCP e Azy Agent (T57):** `list_tasks` passa a aceitar um filtro de janela de alteração, de forma que o agente responda perguntas como "quais cards mudaram nos últimos 3 dias". Mesmo comportamento da API e do board.
- **Datas automáticas pela sprint (T58):** na **criação** de TASK/BUG associada a uma sprint (explícita ou vinculada automaticamente), se o usuário não informar `startDate`/`dueDate`, o item herda as datas de início e fim da sprint. O usuário pode sobrescrever; valores informados sempre têm precedência. Na UI, ao selecionar a sprint na criação, as datas são **sugeridas** (pré-preenchidas) mantendo-se editáveis. Itens existentes não têm datas sobrescritas.

## Capabilities

### New Capabilities
- `item-change-tracking`: semântica do marcador de última alteração do item — quais mutações o atualizam, cascade de registros dependentes para o card dono e propagação para ancestrais, de forma isolada por tenant.

### Modified Capabilities
- `board-filters`: nova dimensão de filtro "Alterados" (janelas de tempo e "sprint atual") no painel Filtros, combinada por AND com os demais filtros.
- `board-filters-persistence`: persistir e restaurar o novo filtro de alteração no estado por projeto, com defaults para estados antigos.
- `active-board-filter-chips`: exibir e permitir remover individualmente o chip do novo filtro de alteração.
- `mcp-tool-registry`: `list_tasks` passa a declarar o campo de janela de alteração como fonte única de schema, validação e projeção.
- `sprint-management`: na criação de card com sprint, datas vazias passam a ser preenchidas com as datas da sprint.
- `card-creation-ui`: formulários de criação (rápido e amplo) sugerem as datas da sprint selecionada, mantendo-as editáveis.

## Impact

**Domínio / contratos**
- `packages/domain` (tipos de item) se necessário; `packages/tool-registry` (`fields.ts`, descrição/projeção de `list_tasks`) e `packages/tool-execution` (`http-adapter.ts`, `registry.ts`) para o novo filtro.

**Banco / persistência**
- Sem coluna nova: usa-se `items.updated_at` existente. Índice de consulta por `(tenant_id, project_id, updated_at)` para as janelas de tempo em SQLite e PostgreSQL.
- Server-side: propaga `updated_at` em checklists, links, anexos, dependências e logs do item; helper de "toque" do card + ancestrais via `ancestry_path` (uma sentença por mutação).

**API**
- `apps/api/src/routes/items.ts` (parse do novo filtro em `GET /items` e `GET /items/tree`), `apps/api/src/validation.ts` (schema do filtro), `apps/api/src/application/items.ts` (default de datas por sprint na criação), rotas de checklist/link/anexo/dependência/log (toque no card).
- `apps/api/src/db/schema.ts` (+ paridade PostgreSQL) para o índice temporal.

**Web**
- `apps/web/src/components/BoardFilters.tsx`, `apps/web/src/components/ActiveFilterChips.tsx`, `apps/web/src/features/board/model/boardView.ts` e `types.ts`, hooks de preferências (`useBoardPreferences`), formulários de criação de card, i18n (`board.json` PT-BR/EN/ES).

**MCP / Azy Agent**
- `packages/tool-registry` e `packages/tool-execution`; `apps/mcp/README.md` e `skills/azyboard/` (referências) se a superfície mudar.

**Testes e gates**
- `integration.test.ts`, testes de contrato MCP (`packages/tool-registry`), paridade SQLite/PostgreSQL, testes web de filtros/persistência/chips e `bun run check`/`bun run test:smoke`.
