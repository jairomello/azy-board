# Design — project-planning-modal

## Context

Ver `proposal.md` para motivação. Estado atual relevante:

- O header do board é renderizado pelo `AppShell` compartilhado, que exibe o
  nome do projeto via `projectName` e o título contextual em `displayTitle`
  (`apps/web/src/components/AppShell.tsx`). É um texto estático com `truncate`.
- A edição do projeto existe em dois lugares hoje desconectados: a seção
  "Planejamento" em Configurações (`ProjectSettingsScreen` +
  `GeneralSettingsSections`, com `startDate`, `plannedEndDate`, `plannedPoints`,
  `plannedHours`, `scope`) e um modal simples que edita apenas o nome em
  `ProjectsPage`.
- Links e anexos existem apenas no escopo do item: `GET/POST/PATCH/DELETE
  /projects/:projectId/items/:itemId/links` (`itemLinks.ts`) e
  `.../attachments` (`attachments.ts`), com persistência `itemLinks.list(...)` e
  `files.listAttachments(...)`. As áreas de UI são `ItemLinksArea` e
  `AttachmentsArea`, usadas como abas do `ItemModal`.

## Goals / Non-Goals

- **Goals**: um único componente de modal de planejamento reutilizado por dois
  pontos de entrada; leitura agregada de links e anexos no escopo do projeto;
  RBAC preservado; downloads continuam pela rota autenticada existente.
- **Non-Goals**: editar links/anexos pela visão agregada (somente leitura);
  alterar o modelo de dados de projeto, links ou anexos; criar endpoints de
  mutação novos; unificar a seção de Configurações.

## Decisions

### D1 — Componente único `ProjectPlanningModal`

Criar `apps/web/src/components/ProjectPlanningModal.tsx` que combina os campos
de planejamento (reutilizando os mesmos labels/inputs de
`GeneralSettingsSections` extraídos para um subcomponente compartilhado) e as
abas somente leitura. Dois pontos de entrada passam a abrir a mesma modal:

- `AppShell` recebe uma prop **aditiva** opcional `onProjectNameActivate?: () => void`.
  Quando presente, o nome do projeto no header vira um `<button>` acessível
  (mantendo o `truncate` e o tooltip); quando ausente, o comportamento atual é
  preservado. O `BoardScreen` fornece o callback e renderiza a modal.
- `ProjectsPage` substitui o modal de edição de nome pela mesma modal, passando
  o `projectId` do card acionado.

Alternativas consideradas: (a) um modal só para o board e manter o modal de nome
na lista — rejeitado, contraria o card ("essa também deve ser a modal mostrada ao
clicar no editar"); (b) tornar o header clicável globalmente no `AppShell` sem
prop — rejeitado, acoplaria páginas sem o requisito e dificultaria o estado da
modal.

### D2 — Edição pela modal reusa `PATCH /projects/:id`

Não há endpoint novo de escrita. A modal edita `name`, `startDate`,
`plannedEndDate`, `plannedPoints`, `plannedHours` e `scope` via
`PATCH /projects/:id` (ADMIN). MEMBER/VIEWER recebem os campos em modo leitura,
como já ocorre em Configurações. O carregamento inicial usa `GET /projects/:id`.

### D3 — Leituras agregadas no escopo do projeto

Adicionar rotas de leitura no escopo do projeto, com `requireRole('VIEWER')` e
verificação de membership (já provida pelo middleware + `userPersistenceContext`):

- `GET /projects/:projectId/links` → todos os links dos itens do projeto, cada um
  com `itemId`/item de origem.
- `GET /projects/:projectId/attachments` → todos os anexos dos cards do projeto,
  cada um com `itemId` de origem, reaproveitando `serializeAttachment`.

Persistência: novos métodos de porta `itemLinks.listByProject(ctx, projectId)` e
`files.listAttachmentsByProject(ctx, projectId)`, implementados nos adapters
(SQLite/PostgreSQL) com filtro por `tenant_id` e `project_id`
(`// [TENANT]`). A leitura agregada de anexos **preserva** o comportamento
existente de leitura mesmo com anexos desabilitados; a UI apenas oculta a aba
quando `GET /tenant/attachments/enabled` retorna `enabled=false`, espelhando o
`ItemModal`.

Alternativas consideradas: (a) endpoint genérico com filtros — rejeitado,
complexidade sem necessidade; (b) reutilizar endpoints por item e agregar no
frontend (N+1 requisições) — rejeitado por custo e por quebrar paginação.

### D4 — Download a partir da lista agregada

Cada anexo agregado carrega seu `itemId` de origem; a UI monta o link de
download já existente
`/projects/:projectId/items/:itemId/attachments/:attachmentId/download`. Nenhuma
rota nova de download; a autorização/ancoragem existente é reutilizada.

### D5 — Semântica, i18n e cache

A modal usa semântica de diálogo (`role="dialog"`, `aria-modal`) e abas
(`role="tab"`/`tabpanel`) como em `ItemModal`. Novas chaves de tradução vão para
os namespaces existentes (`board` para abas; `settings` para labels de
planejamento quando reutilizados), em PT-BR/EN/ES, validadas por `check:i18n`.
As leituras agregadas usam `queryKeys` por projeto para reuso de cache e
invalidação por evento de tempo real quando aplicável.

## Risks / Trade-offs

- [Nome clicável no header compartilhado] → prop opcional aditiva; sem prop, nada
  muda; teste de contrato do `AppShell` cobre o comportamento antigo.
- [Vazamento cross-tenant na leitura agregada] → filtros obrigatórios por
  `tenant_id` e `project_id` no adapter + `requireRole`; testes de isolamento.
- [Anexos desabilitados] → aba oculta na UI e leitura preservada, sem contradizer
  o comportamento atual; teste cobre o estado do tenant.
- [Performance em projetos grandes] → as listagens retornam por projeto; manter
  ordenação estável e considerar paginação/limite se o volume crescer.

## Migration Plan

Sem migração de banco. Deploy é apenas código (frontend + API). Rollback =
reverter o commit; nenhuma mudança de schema ou dados. `bun run check` e
`bun run test:smoke` cobrem typecheck, lint, testes e fluxo web/API.

## Open Questions

Nenhuma pendente que altere specs, abordagem ou tarefas.
