Board ref: 25667747-2b18-43b6-badc-a2e461527c44

## Inventário — responsabilidades do Board e contratos de teste

Evidência da tarefa 1.1. Fonte: leitura do código em 2026-10-06. Não altera
comportamento; classifica o que deve ser preservado como fronteira estrutural e o
que precisa de substituto observável antes de remover o contrato legado.

### `BoardScreen.tsx` (1.220 linhas) por faixa

| Faixa | Responsabilidade |
|---|---|
| 1-63 | Imports (dnd-kit, api, react-query, snapshot, i18n, stores, hooks, model) |
| 65-126 | Assinatura/params/auth/toast; `useBoardData` (72-92); `activeId` (93); `useBoardPreferences` (94-108); estados de UI/modais (109-126) |
| 128-205 | Efeitos: deep-link `?itemId` (128-131); GET do item da modal (133-144); view-session (148-163); baseline (166-169); foco do agente (171-178); invalidação de filtros (184-204); `document.title` (202-205) |
| 208-233 | Sensores DnD (208); collision detection (211-221); `squadMembersMap` (224-233) |
| 235-332 | **(a) Filtros/população**: epics/stories/simpleStory; `storyIdSet`; `boardCards` com Leaf Rule (257-269) |
| 334-430 | Derivados/agrupamento: storyVirtualCards; allDisplayed; epicGroups; orphanCards; moduleGroups; efeito `activeModuleId` (424-430) |
| 350-358 | **(b) DnD/mutações**: `useBoardInteraction` |
| 432-529 | `handleLegacyDragEnd` — **código legado não referenciado no render** |
| 531-830 | **(c) Edição/criação/arquivamento** + **(e) HTTP inline** |
| 832-990 | **(d) Agente**: `assistantSelectedItem`, treeSnapshot, kanbanSnapshot (853-889), screen snapshot (890); helpers de modal (900-971) |
| 989-1220 | **(f) Composição/render**: AppShell, BoardCommandBar, TreeViewPage, DndContext, BoardLanes, BoardModals |

Chamadas HTTP inline em `BoardScreen` (a extrair para controllers): 140, 457, 503,
524, 536, 561, 579, 589, 613, 625, 656, 678, 691, 704, 716, 729, 744, 770, 788,
797, 816, 820.

Invariantes a preservar: Leaf Rule (`257-269`, primitiva `model/types.ts:110-113`);
preferências por projeto (`hooks/useBoardPreferences.ts:19-29,42-83`); densidade/layout
(`useBoardPreferences.ts:45`, `.density-compact`); snapshot do agente
(`lib/assistantSnapshot.ts:80-119`); stores `assistantViewStore`/`assistantFocusStore`.

### Apoio já existente (reutilizar, não duplicar)

- `hooks/useBoardData.ts` (282) — cache remoto, reducer `applyBoardEvent`, WS.
- `hooks/useBoardPreferences.ts` (109) — filtros/colapsos/densidade por projeto.
- `hooks/useBoardInteraction.ts` (72) — DnD com rollback.
- `model/{interaction,mutation,types}.ts` — helpers puros e `runOptimisticMutation`.
- `components/{BoardLanes,BoardColumns,BoardModals}.tsx`.

### Classificação dos testes que leem o código-fonte

**Invariantes estruturais legítimos (manter, marcados `[CONTRATO-ESTRUTURAL]`):**

- `no-imperative-fetch-guard.test.ts` — ausência de padrões imperativos.
- `app-shell-layout-contract.test.ts`, `item-modal-layout-contract.test.ts`,
  `item-modal-spacing-contract.test.ts`, `board-compact-density-contract.test.ts`
  (parte CSS), `project-visibility-badges-contract.test.ts` (parte cores),
  `kanban-card-layout-contract.test.ts` (ordem/clamp) — layout/CSS que o happy-dom
  não calcula.
- `frontend-page-modularity-contract.test.ts` — fronteira de módulo.
- `lib/appUrl-usage-contract.test.ts` — uso obrigatório de `resolveAppUrl`.
- `lib/iconCatalog.test.ts` — paridade de catálogos (importa módulos, não lê fonte).

**Contratos comportamentais disfarçados (exigem substituto observável antes de remover):**

- `ui-mode-contract.test.ts` — regras de filtro/persistência/custo/vazio/árvore/editores.
- `optimistic-mutations-contract.test.ts` — 409/`expectedUpdatedAt`/`applyBoardEvent`.
- `migrated-screens-cache-contract.test.ts`, `tree-cache-contract.test.ts` — caminho de cache.
- `project-visibility-contract.test.ts` — `includeHidden`/`sessionStorage`.
- `login-session-contract.test.ts` — payload de login/remember (já há `LoginPage.test.tsx`).
- `checklist-advanced-fields-contract.test.ts`, `attachment-metadata-contract.test.ts`,
  `history-worklog-panel-contract.test.ts`, `epic-story-forms-contract.test.ts`,
  `card-copy-reference-contract.test.ts`, `rich-text-editor-contract.test.ts`,
  `dashboard-contract.test.ts` — comportamento de UI/API.
- `accordion-item-detail-contract.test.ts`, `assistant-screen-context.test.ts`,
  `assistant-view-commands-contract.test.ts`, `assistant-ui-contract.test.ts` (maioria) —
  composição DOM/lógica de snapshot.
- `hooks/useWebSocket.test.ts` (parte da máquina de estados) — híbrido; backoff/zumbi
  são comportamento real, a checagem de fonte é estrutural.

**Brecha do gate:** `scripts/check-frontend-tests.ts` cobre `fetch(new URL(`,
`readFileSync(` e `Bun.file(` — não cobre `readFile(` de `node:fs/promises` nem
`import.meta.url` isolado.

### Gate i18n atual

- `scripts/check-i18n.ts` (72 linhas): paridade de chaves PT-BR/EN/ES (namespaces
  `common,auth,board,settings,dashboard,dashboardDescriptions,assistant`) + regex de
  texto JSX/atributos **com acento**. Não detecta texto PT sem acento nem valida uso
  real das chaves. Ignora `*.test.*`.
- Dicionários: `apps/web/src/i18n/locales/{pt-BR,en,es}/*.json` (JSON plano,
  `{{interpolação}}`), `fallbackLng: 'pt-BR'`.

### AST

- Reutilizar `typescript` 5.9.3 (Apache-2.0). Resolve a partir de `apps/web`, **não**
  da raiz/`scripts/`; usar `createRequire` apontando para `apps/web` ou `--cwd`.
- Sem novas dependências: `@typescript-eslint/*` e `oxc-parser` ausentes; `@babel/*`
  e `acorn` só transitivos (não resolvem). `@biomejs/biome` é CLI, sem API JS.

## Fronteiras após a extração (tarefas 2.1–2.5)

`BoardScreen.tsx` passou de 1.220 para ~570 linhas e não executa HTTP nem
implementa inline filtros/população, DnD, edição/arquivamento, carregamento de
modal ou sessão/fotografia do agente. Fronteiras:

| Módulo | Responsabilidade |
|---|---|
| `model/boardView.ts` | filtros/população (Leaf Rule), cards de história, agrupamento EPIC→STORY→CARD e por módulo, órfãos |
| `model/{interaction,mutation,types}.ts` | helpers puros, payload de criação e política única de mutação otimista |
| `hooks/useBoardData` | cache remoto (TanStack Query) + reducer de eventos WS |
| `hooks/useBoardPreferences` | preferências por projeto (filtros/colapsos/densidade) |
| `hooks/useBoardInteraction` | DnD/mutações com rollback |
| `hooks/useBoardItemEditing` | edição/criação: itens, tags, épico, história, subtask, módulo |
| `hooks/useBoardItemModal` | detalhe do item com cancelamento de respostas antigas |
| `hooks/useBoardArchiving` | confirmação em cascata, arquivamento e restauração |
| `hooks/useBoardFilterValidation` | coerência dos filtros vs catálogos e board simples |
| `hooks/useBoardAgentSession` | comandos de visão (T17/T18), foco (T19) e fotografia (T16) |

Contratos estruturais que liam o `BoardScreen` foram redirecionados aos novos
módulos onde o comportamento passou a residir; a cobertura comportamental
correspondente está em `model/boardView.test.ts` e nos testes DOM de componente.

## Cobertura de falhas e acessibilidade (Seção 3)

- 409/403 de edição: `hooks/useBoardItemEditing.test.tsx` (409 reconcilia + avisa
  sem sucesso aparente; 403 feedback consistente; ambos sem retry automático).
- 409/403 de movimento e rollback concorrente: `board-interaction.test.ts`
  (rollback + feedback, sem repetição; atualização mais recente de outro item
  preservada no rollback).
- Resposta tardia/troca de item e projeto: `hooks/useBoardItemModal.test.tsx`.
- Lacuna/reconexão (T39): `lib/realtimeSession.test.ts` consumindo as fixtures
  do contrato (`test/fixtures/serverContracts.ts`).
- Acessibilidade: `BoardModals` expõe `role="dialog"`, `aria-modal` e nome
  acessível; foco inicial no painel e Escape fecha
  (`board-modals.test.tsx`). Nomes acessíveis de todos os controles verificados
  em `board-filters.test.tsx`. Feedback/rótulos presentes nos três locales
  (`locales-feedback.test.ts`). Alternativa de teclado ao drag: o select de
  status da modal de item (`ItemModal` → `t('statusLabel')`) permite mover o card
  sem ponteiro. Sem integração de `axe-core` no runner; a auditoria automatizada
  cobre nomes acessíveis e papéis.
