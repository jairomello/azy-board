## 1. Migration — Banco de dados

- [x] 1.1 Criar tabela `project_cost_centers` (id, tenant_id, project_id, code, description, sort_order, created_at) com índice único em (tenant_id, project_id, code) — `// [TENANT] tenant_id obrigatório para isolamento cross-tenant` `// [DB-SWAP] tipo serial/uuid e autoincrement diferem entre SQLite e PostgreSQL`
- [x] 1.2 Criar tabela `project_squads` (id, tenant_id, project_id, name, created_at) — `// [TENANT]` `// [DB-SWAP]`
- [x] 1.3 Adicionar coluna `manager_user_id` nullable (FK para users) na tabela `projects`
- [x] 1.4 Adicionar coluna `squad_id` nullable (FK para project_squads) na tabela `project_members`
- [x] 1.5 Adicionar colunas `cost_center_id` nullable (FK para project_cost_centers) e `status_before_archive` nullable na tabela `unified_items`
- [x] 1.6 Adicionar valor `ARCHIVED` ao enum de status (ou verificar se o campo usa string — neste caso apenas documentar o valor aceito)
- [x] 1.7 Atualizar schema Drizzle com todas as novas tabelas e colunas; rodar `bun run db:push` para aplicar

## 2. Backend — Centros de Custo

- [x] 2.1 Implementar `GET /projects/:id/cost-centers` — retornar lista ordenada por sort_order com withTenant — `// [TENANT]`
- [x] 2.2 Implementar `POST /projects/:id/cost-centers` — validar unicidade de code por projeto, persistir com tenant_id — `// [TENANT]`
- [x] 2.3 Implementar `PATCH /projects/:id/cost-centers/:ccId` — atualizar code/description com verificação de ownership e tenant — `// [TENANT]`
- [x] 2.4 Implementar `DELETE /projects/:id/cost-centers/:ccId` — verificar se há tasks associadas (retornar 409 se sim) antes de excluir — `// [TENANT]`
- [x] 2.5 No handler de `POST /projects/:id/tasks` (criação de item): após inserção, buscar o primeiro cost center do projeto (menor sort_order) e atribuir ao novo item se existir — `// [TENANT]`

## 3. Backend — Gerente Geral do Projeto

- [x] 3.1 Adicionar campo opcional `manager_user_id` no handler de `POST /projects` (criação) — validar que o usuário é membro se informado
- [x] 3.2 Adicionar campo opcional `manager_user_id` no handler de `PATCH /projects/:id` (atualização) — validar membership do gerente indicado — `// [TENANT]`
- [x] 3.3 Incluir dados do gerente (id, nome, e-mail) na resposta de `GET /projects/:id`

## 4. Backend — Squads e Membros

- [x] 4.1 Implementar `GET /projects/:id/squads` — retornar squads com contagem de membros — `// [TENANT]`
- [x] 4.2 Implementar `POST /projects/:id/squads` — criar squad com name e tenant_id — `// [TENANT]`
- [x] 4.3 Implementar `PATCH /projects/:id/squads/:squadId` — renomear squad — `// [TENANT]`
- [x] 4.4 Implementar `DELETE /projects/:id/squads/:squadId` — ao excluir, limpar squad_id dos membros associados; retornar aviso com contagem antes da exclusão — `// [TENANT]`
- [x] 4.5 Atualizar `GET /projects/:id/members` para incluir `squad_id`, `squad_name` e `role` na resposta — `// [TENANT]`
- [x] 4.6 Atualizar `POST /projects/:id/members` (adicionar membro) para aceitar `squad_id` opcional e `role` obrigatório — `// [TENANT]`
- [x] 4.7 Implementar `PATCH /projects/:id/members/:memberId` — atualizar `squad_id` e/ou `role` do membro — `// [TENANT]`

## 5. Backend — Arquivamento

- [x] 5.1 Implementar `POST /projects/:id/tasks/:taskId/archive` — dentro de transação: setar `status_before_archive = status` atual e `status = 'ARCHIVED'` no item e em todos os descendentes via ancestry_path — `// [TENANT]`
- [x] 5.2 Implementar `POST /projects/:id/tasks/:taskId/unarchive` — dentro de transação: restaurar `status = status_before_archive ?? 'NOT_STARTED'`, limpar `status_before_archive`; restaurar em cascata todos os descendentes arquivados e todos os ancestrais arquivados até a raiz — `// [TENANT]`
- [x] 5.3 Implementar `GET /projects/:id/tasks/archived` — retornar todos os items com `status = 'ARCHIVED'` do projeto com campos: id, type, title, ancestry_path (para derivar épico ancestral), status_before_archive, updated_at — `// [TENANT]`
- [x] 5.4 Atualizar queries de board e tree view para filtrar `status != 'ARCHIVED'` por padrão — `// [TENANT]`
- [x] 5.5 No endpoint de movimentação de cards, rejeitar com 422 se o item possui `status = 'ARCHIVED'`

## 6. Frontend — Configurações do Projeto: Gerente Geral

- [x] 6.1 Adicionar campo "Gerente Geral" (select de membros do projeto) no formulário de criação de projeto
- [x] 6.2 Adicionar campo "Gerente Geral" editável na seção de configurações gerais do projeto (Settings); carregar membros via `GET /projects/:id/members`
- [x] 6.3 Exibir nome e e-mail do gerente atual; permitir remover (limpar para null)

## 7. Frontend — Configurações do Projeto: Membros & Squads (redesenho)

- [x] 7.1 Separar a seção "Membros & Squads" em duas subseções distintas: "Squads" (topo) e "Membros do Projeto" (abaixo)
- [x] 7.2 Na subseção "Squads": listar squads com nome e contagem de membros; botão "+ Criar squad" com input inline; ícone de edição (renomear) e botão de exclusão por squad
- [x] 7.3 Na subseção "Membros": listar membros com nome, e-mail, badge de role e nome do squad; botão explícito "+ Adicionar membro" no topo da lista
- [x] 7.4 Criar dialog "Adicionar membro": campo de busca por e-mail, select de papel (ADMIN/MEMBER/VIEWER), select opcional de squad; botão "Confirmar"
- [x] 7.5 Criar dialog "Editar membro": pré-preencher com dados atuais; permitir alterar squad e papel; salvar via `PATCH /projects/:id/members/:memberId`
- [x] 7.6 Botão "Remover" por membro com dialog de confirmação; chamar endpoint de remoção

## 8. Frontend — Configurações do Projeto: Centros de Custo

- [x] 8.1 Criar seção "Centros de Custo" nas configurações do projeto (após Membros & Squads)
- [x] 8.2 Listar centros de custo com código e descrição; formulário inline para criar novo (inputs Código + Descrição + botão Adicionar)
- [x] 8.3 Ícone de edição por item que abre inline edit ou dialog; botão de exclusão com tratamento do erro 409 (mostrar aviso com contagem de tasks)
- [x] 8.4 Exibir seção em modo somente leitura para VIEWER e MEMBER

## 9. Frontend — Modal de Task/Subtask/Bug: centro de custo

- [x] 9.1 Na modal de criação/edição de task, verificar se o projeto possui cost centers; se sim, exibir select "Centro de Custo" com todas as opções + opção "— Nenhum —"
- [x] 9.2 Na criação, pré-selecionar o primeiro cost center retornado pela API (o mesmo que o backend atribui automaticamente)
- [x] 9.3 Ao salvar, incluir `cost_center_id` (ou null) no payload de PATCH/POST
- [x] 9.4 Replicar o mesmo comportamento para modais de Bug e Subtask

## 10. Frontend — Board: Arquivamento

- [x] 10.1 Adicionar opção "Arquivar" no menu "..." de cards no board; chamar `POST /archive`; exibir dialog de confirmação quando item tem descendentes (informar quantidade)
- [x] 10.2 Adicionar opção "Arquivar" no menu de ação de itens na tree view (épicos, stories, tasks)
- [x] 10.3 Após arquivamento bem-sucedido, remover item (e seus descendentes) da UI local imediatamente
- [x] 10.4 Criar botão "Ver itens arquivados" na toolbar do board
- [x] 10.5 Criar modal "Itens Arquivados": grid/tabela com colunas Tipo (ícone), Título, Épico ancestral, Coluna original, Data de arquivamento; botão "Restaurar" por linha
- [x] 10.6 Ao restaurar, chamar `POST /unarchive`; fechar modal e re-fetch de items para reaparecer no board/tree
- [x] 10.7 Exibir estado vazio na modal quando não há itens arquivados

## 11. Frontend — Board: Filtro "Ocultar épicos vazios"

- [x] 11.1 Adicionar toggle "Ocultar épicos vazios" na barra de filtros do board (mesmo grupo de filtros existente)
- [x] 11.2 Implementar lógica client-side: após aplicar os demais filtros, filtrar a lista de épicos removendo os que não possuem nenhum descendente em `displayedTasks`
- [x] 11.3 Incluir o toggle no controle de "filtro ativo" (contribuir para contagem/indicador)
- [x] 11.4 Garantir que "Limpar filtros" desativa o toggle junto com os outros filtros
- [x] 11.5 Aplicar a mesma lógica na tree view hierárquica: quando o toggle estiver ativo, ocultar épicos sem filhos visíveis
