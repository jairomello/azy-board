# Proposal

## Why

O board já modela hierarquia, prazos e vínculos (links/anexos), mas não expressa a ordem de execução entre itens. Sem dependências, o cronograma só existe na cabeça das pessoas e o sistema não distingue trabalho bloqueado por sequência de um simples atraso. O T46 pede o cadastro de dependências entre itens — pré-requisito para o replanejamento automático de datas que virá em cards futuros.

## What Changes

- Nova tabela de dependências de item (`item_dependencies`) com `tenant_id`, projeto, item de origem, item dependido, tipo de dependência e retardo em dias.
- Quatro tipos de dependência no vocabulário de cronograma (MS Project): Término-Início (FS, default), Início-Início (SS), Início-Término (SF) e Término-Término (FF).
- Retardo (`lagDays`) por dependência, aceitando valores positivos e negativos (folga/antecipação).
- Endpoints CRUD em `GET/POST/PATCH/DELETE /projects/:projectId/items/:itemId/dependencies`, com RBAC, anti-IDOR e idempotência no POST, seguindo o padrão de `item_links`.
- Alvo da dependência: qualquer item do **mesmo projeto** (TASK, BUG, STORY ou EPIC), sem dependências cross-project.
- Bloqueio de dependências circulares (diretas ou indiretas): a API rejeita criação/edição que feche um ciclo.
- Nova aba "Dependências" no card, com seletor de item, seletor de tipo, campo de retardo e lista de dependências, seguindo o padrão de `ItemLinksArea` (lazy + `Suspense`, i18n PT-BR/EN/ES).
- Visualizações das dependências fora do card:
  - **Coluna "Dependências" na visão de árvore**, listando para cada linha os itens dos quais ela depende (identificação `sequenceCode` como no MS Project, com fallback de título), direto no payload de `GET /items/tree`.
  - **Indicador no card do board**: ícone + contagem de dependências (quantos itens aquele card depende), visível também para leitores, oculto quando não houver dependências.
- Contratos de resposta expõem `dependencies` e `dependencyCount` para os itens no board e na árvore, sem inflar o payload do board com dados completos.
- Cascata de exclusão: dependências são removidas junto com o item (origem ou alvo), integrando o plano de exclusão e a auditoria de integridade existentes.

Fora de escopo desta change (viram cards futuros): replanejamento automático de datas, caminho crítico, dependências cross-project, e as ferramentas MCP/Azy Agent para dependências.

## Capabilities

### New Capabilities
- `item-dependencies`: cadastro, validação (tipo + retardo + ausência de ciclos), persistência multi-tenant, exposição de `dependencies`/`dependencyCount` no payload e apresentação da aba de dependências entre itens do mesmo projeto.

### Modified Capabilities
- `tree-view`: a coluna "Dependências" passa a fazer parte das colunas exibidas na visão de árvore.
- `kanban-card-layout`: o card passa a exibir indicador condicional de ícone + contagem de dependências.
<!-- A capacidade deletion-integrity não muda: já cobre genericamente a política de FK de novas tabelas filhas. -->

## Impact

**Banco / migrations**
- `apps/api/src/db/schema.ts`: nova tabela `itemDependencies` + relations.
- `apps/api/src/db/postgres/schema.ts` e `apps/api/src/db/postgres/migrations/00XX_item_dependencies.sql`: espelho PG (SQL/CHECKs/FK composta).
- `apps/api/src/db/migrations/00XX_item-dependencies.sql` + snapshot/journal (SQLite).
- `apps/api/src/db/installationMarkers.ts` (`APP_TABLES`) e `apps/api/src/db/postgres/index.ts` (`APP_TABLES`).
- `apps/api/src/db/integrity.ts` (checks de órfão/cross-tenant).
- Cascatas explícitas: `apps/api/src/db/sqlite/itemUnitOfWork.ts` e `apps/api/src/db/postgres/adapter.ts`.

**Persistência (ports/adapters)**
- `apps/api/src/persistence/models.ts` (`ItemDependencyRecord`), `ports.ts` (`ItemDependencyPort`, `PersistenceTransaction`).
- `apps/api/src/db/sqlite/adapter.ts` e `apps/api/src/db/postgres/adapter.ts` (CRUD + cascade).
- `packages/domain` / `packages/ui-contracts` (enum de tipo de dependência e contrato de transporte).

**API**
- Nova rota `apps/api/src/routes/itemDependencies.ts` e registro em `apps/api/src/index.ts`.
- Schemas Zod em `apps/api/src/validation.ts`; verificação de ciclo na camada de serviço.
- `GET /projects/:projectId/items/:itemId` pode passar a incluir `dependencies` (a decidir no design).

**Web**
- `apps/web/src/components/ItemModal.tsx` (nova aba + lazy import).
- Novo `apps/web/src/components/ItemDependenciesArea.tsx`.
- `apps/web/src/components/ItemDependenciesColumn.tsx` (coluna na Tree View) e `apps/web/src/components/KanbanCard.tsx` (indicador de contagem).
- Payload de `GET /items`/board e `GET /items/tree` expõe `dependencies` (resumo) e `dependencyCount`.
- i18n em `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json`.
- Possível entrada de chunk lazy sob o orçamento de `check:bundle`.

**Testes**
- API `integration.test.ts`, MCP não se aplica nesta change; web `item-dependencies-area.test.tsx`; migrations/parity/integrity.

## Board ref

Board ref: `11feedcb-150d-4eb1-8d6f-98312f43184e` (T46 — Criar cadastro de Dependências nas Tasks).
