## Context

O Azy Board usa o modelo unificado `unified_items` para épicos, stories, tasks e bugs. Projetos têm membros com roles (ADMIN/MEMBER/VIEWER). A tela de Settings atual mistura membros e squads em uma única seção sem botão de "adicionar membro", e a lista de membros não exibe squad nem role de forma clara. O board exibe todos os epics e cards não-arquivados; não existe mecanismo de arquivamento nem filtro para épicos vazios.

## Goals / Non-Goals

**Goals:**
- Adicionar centros de custo por projeto com associação automática em tasks
- Permitir indicar um Gerente Geral por projeto (campo informativo)
- Redesenhar Membros & Squads nas Settings: separação clara, adicionar membro com squad/papel, CRUD de squads
- Introduzir status `ARCHIVED` em `unified_items` com arquivamento cascata e modal de restauração
- Adicionar toggle "Ocultar épicos vazios" nos filtros do board (client-side)

**Non-Goals:**
- Permissões especiais baseadas no Gerente Geral (sem RBAC adicional nesta versão)
- Exportação ou relatório financeiro de centros de custo
- Arquivamento de projetos inteiros
- Paginação do modal de itens arquivados (primeira versão usa lista simples)

## Decisions

### 1. Centro de custo como tabela separada, FK em unified_items

**Decisão**: nova tabela `project_cost_centers (id, tenant_id, project_id, code VARCHAR(20), description VARCHAR(200), sort_order INTEGER, created_at)`. Campo `cost_center_id` nullable em `unified_items`.

**Alternativa descartada**: armazenar código/descrição direto em unified_items como texto livre — impossibilitaria agrupamento e relatórios futuros.

**Regra de auto-preenchimento**: no handler de criação de task, se o projeto tiver cost centers cadastrados, buscar o de menor `sort_order` e atribuir ao novo item. Executado server-side para garantir consistência mesmo via MCP.

### 2. Gerente Geral como coluna nullable em `projects`

**Decisão**: coluna `manager_user_id UUID` nullable com FK para `users`. Exibido na UI como campo informativo; sem RBAC adicional.

**Alternativa descartada**: role especial "MANAGER" em `project_members` — complexidade desnecessária sem features de permissão específicas nesta versão.

### 3. Squads com tabela própria; membros com squad_id e role

**Decisão**: nova tabela `project_squads (id, tenant_id, project_id, name, created_at)`. Coluna `squad_id` nullable + `role` (já existia) em `project_members`. UI de Settings redesenhada em duas subseções: "Squads" acima com CRUD, "Membros" abaixo com lista e botão "+ Adicionar membro" que abre um dialog (busca usuário por e-mail, seleciona squad e role).

**Alternativa descartada**: drag-and-drop de membro para squad (conforme spec anterior) — muito complexo para a UX real; a abordagem de dialog é mais simples e acessível.

### 4. Status ARCHIVED em unified_items com coluna status_before_archive

**Decisão**: adicionar `ARCHIVED` ao enum de status. Adicionar coluna `status_before_archive` (nullable) para permitir restauração ao status original.

**Arquivamento cascata**: endpoint `POST /projects/:id/tasks/:taskId/archive` executa um UPDATE em cascata usando `ancestry_path` — todos os items cujo `ancestry_path` contém o `taskId` como ancestral são arquivados junto. Operação em transação única.

**Restauração**: endpoint `POST /projects/:id/tasks/:taskId/unarchive` restaura o item e todos seus descendentes para `status_before_archive`. Se `status_before_archive` for null (dados legados), restaura para `NOT_STARTED`. Ao desarquivar um item cujo pai está arquivado, o pai também é desarquivado em cascata (restaura a cadeia até a raiz).

**Visibilidade**: queries de board e tree view filtram por `status != 'ARCHIVED'` por padrão. Modal "Ver arquivados" usa endpoint dedicado que retorna apenas arquivados.

**Modal de arquivados**: exibição em formato de tabela/grid (mais simples que cards) com colunas: Tipo (ícone), Título, Épico ancestral, Coluna original (via `status_before_archive` mapeado para nome de coluna), Data de arquivamento. Botão "Restaurar" por linha.

### 5. Filtro "Ocultar épicos vazios" client-side

**Decisão**: toggle no toolbar (seção de filtros). Aplicado sobre `displayedTasks` em memória — um épico é "vazio" se nenhum dos items carregados (não-arquivados) tem esse épico como ancestral. Sem re-fetch.

**Por que client-side**: consistente com a decisão existente de filtros em memória; épicos já estão carregados.

## Risks / Trade-offs

- **[Risco] Cascade archive em árvores grandes** → Mitigação: a query UPDATE usa `ancestry_path` (JSON desnormalizado), tornando a busca de descendentes O(1) por índice; a transação é atômica mas pode ser lenta para projetos com milhares de tasks — aceitável na primeira versão.
- **[Trade-off] status_before_archive pode ficar desatualizado** → Se um item for movido de coluna enquanto arquivado (via API direta), `status_before_archive` ficará desatualizado. Mitigação: arquivamento bloqueia movimentação de cards arquivados no board.
- **[Risco] Filtro "épicos vazios" com filtros combinados** → Um épico pode parecer "vazio" após filtro por responsável mesmo tendo cards atribuídos a outros. Mitigação: o toggle "Ocultar épicos vazios" considera épicos vazios *depois* dos outros filtros serem aplicados — comportamento intuitivo e documentado.

## Migration Plan

1. Executar migration SQL: criar `project_cost_centers`, `project_squads`; adicionar colunas `cost_center_id`, `status_before_archive` em `unified_items`; adicionar `manager_user_id` em `projects`; adicionar `squad_id` em `project_members`; adicionar `ARCHIVED` ao enum de status.
2. Dados existentes: `status_before_archive = NULL` para registros existentes (restauração usa fallback para `NOT_STARTED`).
3. Rollback: remover colunas e tabelas adicionadas; remover `ARCHIVED` do enum (requer verificar que nenhum item tem esse status antes do rollback).

## Open Questions

- Ordenação dos centros de custo: por `sort_order` (drag para reordenar?) ou alfabética? **Decisão inicial**: por `sort_order` com input em ordem de inserção; reordenação pode ser adicionada depois.
- O Gerente Geral deve aparecer visível no card do projeto na listagem? **Decisão inicial**: apenas nas Settings, não na listagem de projetos.
