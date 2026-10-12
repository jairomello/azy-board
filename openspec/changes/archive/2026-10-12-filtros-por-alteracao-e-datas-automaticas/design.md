# Design

**Board ref:** T57 `045736de-b489-4af1-ab11-ac94bba9106b` · T58 `849fe963-f5e4-4338-8ea1-0cf5541d255c`

## Context

Ver `proposal.md` — Why. Pontos de partida confirmados no código:

- `items.updated_at` já existe (`apps/api/src/db/schema.ts`) e é atualizado nas mutações do **próprio item** (`application/items.ts`, `itemUnitOfWork.ts`, `db/sqlite/adapter.ts`). Não há coluna de "última alteração de dependentes".
- Registros dependentes vivem fora de `items`: `checklists`/`checklist_items`, `item_links`, `attachments`, `item_dependencies`, `item_logs`/`item_events`, além de subtasks (itens filhos por `parent_id`).
- `ancestry_path` desnormaliza os ancestrais em JSON por item (usado em breadcrumb e progresso), o que permite resolver a propagação sem recursão.
- Toda query passa por `withTenant`/contexto de tenant; os adapters SQLite e PostgreSQL devem manter paridade.
- Filtros do board são client-side (`features/board/model/boardView.ts`) e persistidos por projeto (`board-filters:<projectId>`); filtros de leitura do agente passam por `packages/tool-registry` → `packages/tool-execution` → `GET /projects/:id/items`.
- Na criação, `createItemApplication` já resolve sprint explícita ou vigente e grava `startDate`/`dueDate` como `null` quando ausentes.

## Goals / Non-Goals

**Goals:**
- Marcador de última alteração confiável, cobrindo card + dependentes + ancestrais, em uma operação por mutação.
- Filtro de janela de alteração com o mesmo comportamento no board, na API, no MCP e no Azy Agent.
- Datas de TASK/BUG herdadas da sprint na criação, sem sobrescrever escolha do usuário.

**Non-Goals:**
- Não recalcular datas de itens existentes quando a sprint muda (decisão registrada em `sprint-management`).
- Não criar histórico/auditoria novo: o marcador é silencioso (sem eventos de log/domínio adicionais).
- Não alterar a semântica de `updatedAt` usada hoje para ordenação/arquivamento, apenas ampliá-la.
- Não introduzir biblioteca de datas nova.

## Decisions

### 1. Marcador em `updated_at` existente + índice temporal

Usar a coluna `items.updated_at` como marcador, em vez de uma tabela/coluna nova. Adicionar índice `(tenant_id, project_id, updated_at)` no SQLite e no PostgreSQL para as janelas de tempo.

- **Por quê:** evita uma segunda fonte de verdade e migração de dados; o campo já é retornado em `list_tasks` (`PROJECTION_FIELDS`).
- **Alternativas:** tabela `item_changes` (mais poder analítico, mais custo e duplicação); coluna `last_activity_at` separada (duas semânticas concorrentes).

### 2. Propagação em lote via `ancestry_path`, não recursão

Ao alterar o item X ou um registro dependente de X: ler `ancestry_path` de X, montar `ids = [X, ...ancestrais]` e emitir **um** `UPDATE items SET updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id IN (ids)` na mesma transação da mutação.

- **Por quê:** profundidade fixa (EPIC→STORY→TASK→subtask), zero consulta por nível, sem laço nem risco de recursão infinita — atende à preocupação de N+1/lentidão levantada no card.
- **Alternativas:** CTE recursiva (mais poder, mais custo e complexidade desnecessária); subir um nível por vez (N+1, loops).

### 3. Ponto de hook no adapter de persistência

Aplicar o "toque" nas mutações de dependentes dentro dos adapters de persistência (`db/sqlite/adapter.ts` e paridade `db/postgres/adapter.ts`), em um helper único `touchItemAndAncestors(context, projectId, itemId)`.

- **Por quê:** garante cobertura de todos os caminhos (web, REST, MCP, agente, batch) em um só lugar, mantendo a fonte única no adapter.
- **Alternativas:** hook nas rotas (fácil esquecer um caminho e divergir entre REST/MCP); trigger de banco (pouco portável e difícil de testar em paridade).

### 4. Janela de tempo calculada em dias-calendário no fuso do projeto

Definir o início da janela como `00:00` de `N` dias atrás no fuso `America/Sao_Paulo` e comparar `updated_at >= início` (UTC ISO). Mapa das opções: `1d`=último dia (ontem), `2d`, `3d`, `5d`, `1w`=7, `1m`=30, `current-sprint`=cards da sprint vigente. A função de cálculo é pura (recebe o instante de referência) para testes determinísticos.

- **Por quê:** o card descreve "de ontem para hoje"; a unidade dias-calendário é previsível para o gestor; alinha com o uso de fuso já existente em `query_planning_gaps`.
- **Alternativas:** janelas móveis de 24h (menos intuitivo para "ontem/hoje"); UTC puro (desloca o dia para o usuário).

### 5. Um único nome de filtro em todas as camadas

Campo `updatedWithin` em `list_tasks` (registry) e `GET /items`; no board, a dimensão "Alterados" reutiliza os mesmos valores. Aplicação client-side no board e server-side na API/MCP, com o mesmo mapa de janelas em `packages/domain`/`ui-contracts` para não duplicar a regra.

- **Por quê:** o card exige paridade board/MCP/agente; um mapa compartilhado evita divergência.
- **Alternativas:** reimplementar em cada camada (risco de divergência silenciosa).

### 6. Datas da sprint na criação, preenchendo apenas o que falta

Em `createItemApplication` (e no caminho de lote), quando houver sprint efetiva e `startDate`/`dueDate` vierem `undefined`/`null`, preencher com `sprint.startDate`/`sprint.endDate`. Valor informado pelo usuário nunca é sobrescrito; preencher só o campo ausente quando o outro foi informado. Na UI, pré-preencher ao selecionar a sprint, marcando como sugestão (limpa se a sprint for removida e a data não foi digitada).

- **Por quê:** atende "sugerir e permitir mudar"; mantém o item com cronograma mesmo sem ação do usuário.
- **Alternativas:** recalcular no board ao trocar sprint (fora de escopo, decidido na clarificação).

## Risks / Trade-offs

- [Ruído no filtro: reordenar/arquivar toca `updated_at` e pode aparecer como "alterado hoje"] → Aceitável e documentado; é uma alteração real do card. Revisar o texto do filtro ("Alterados") para não prometer apenas "movimentados".
- [Propagação silenciosa pode mascarar deltas de auditoria] → O marcador não substitui `itemLogs`/`item_events`; nenhum log novo é criado, apenas o carimbo de tempo.
- [Divergência SQLite × PostgreSQL na propagação e no índice] → Testes de paridade obrigatórios (`db/postgres/parity.test.ts`) e `PRAGMA foreign_key_check`/constraints preservadas.
- [Diferença de fuso no cliente × servidor] → Fonte única do cálculo da janela; o cliente recebe `updatedAt` já em UTC e aplica o mesmo mapa.
- [Datas de sprint podem ficar desatualizadas se a sprint for editada depois] → Decisão explícita de não recalcular itens existentes (ver `sprint-management`); documentar no texto de ajuda.
- [Idempotência: tocar o mesmo item repetidamente] → O `UPDATE` é uma escrita simples e idempotente; mantém `expectedUpdatedAt` (revisão otimista) intacto nas mutações existentes.

## Migration Plan

Sem migração de dados: usa-se coluna existente. Aplica-se apenas um índice novo (`items(tenant_id, project_id, updated_at)`) nas migrations SQLite e PostgreSQL, com paridade e sem remover constraints. Rollback: remover o índice e reverter os hooks de propagação/filtro; nenhum dado precisa ser convertido.

## Open Questions

- Nenhuma pendente que altere specs, abordagem ou tarefas.
