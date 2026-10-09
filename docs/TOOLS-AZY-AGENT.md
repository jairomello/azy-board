# Tools Disponíveis no Azy Agent

> Relação completa das ferramentas MCP do Azy Board e de automação de browser.

---

## 📋 Board / Projeto

| Tool | Descrição |
|------|-----------|
| `azy-board_create_project` | Cria um novo projeto no Azy Board |
| `azy-board_get_project` | Consulta dados de um projeto por ID ou nome |
| `azy-board_list_projects` | Lista projetos acessíveis à credencial |
| `azy-board_update_project` | Atualiza campos do projeto (nome, descrição, boardMode, planejamento) |
| `azy-board_delete_project` | Exclui um projeto e registros dependentes (ação destrutiva, suporta dryRun) |
| `azy-board_create_project_structure` | Cria projeto + hierarquia de até 50 itens em uma operação atômica |
| `azy-board_get_board` | Retorna colunas, módulos e itens do board do projeto |
| `azy-board_get_screen_overview` | Digest do board em um único passo: contagens por coluna |
| `azy-board_get_shadow_markdown` | Retorna o board do projeto em Markdown para leitura rápida |
| `azy-board_get_tree` | Retorna hierarquia de itens (EPIC > STORY > TASK/BUG) |

## 📝 Itens / Tasks

| Tool | Descrição |
|------|-----------|
| `azy-board_create_task` | Cria um item EPIC, STORY, TASK ou BUG |
| `azy-board_list_tasks` | Lista itens do projeto com filtros opcionais |
| `azy-board_update_item` | Atualiza campos específicos de um item |
| `azy-board_update_items` | Atualiza itens em massa por filtros (bulk update) |
| `azy-board_move_task` | Move um item para outra coluna pelo nome |
| `azy-board_batch_move` | Move até 500 itens para uma coluna em uma operação atômica |
| `azy-board_complete_task` | Conclui um item (move para coluna DONE) |
| `azy-board_claim_task` | Atribui o item ao usuário atual |
| `azy-board_release_task` | Libera a atribuição do item |
| `azy-board_archive_item` | Arquiva um item |
| `azy-board_unarchive_item` | Desarquiva um item |
| `azy-board_delete_item` | Exclui um item (ação destrutiva, suporta dryRun) |
| `azy-board_batch` | Cria hierarquia de até 50 itens em uma operação atômica |
| `azy-board_duplicate_structure` | Duplica uma STORY ou subárvore TASK/BUG |

## ✅ Checklists

| Tool | Descrição |
|------|-----------|
| `azy-board_list_checklists` | Lista checklists e seus passos de um card |
| `azy-board_create_checklist` | Cria uma checklist nomeada em um card |
| `azy-board_add_checklist_item` | Adiciona passo a uma checklist existente (requer checklistId) |
| `azy-board_add_checklist_item_to_task` | Adiciona passo por nome da checklist (cria se não existir) |
| `azy-board_update_checklist` | Atualiza nome/posição de uma checklist |
| `azy-board_update_checklist_item` | Atualiza texto/estado de um passo |
| `azy-board_check_item` | Marca/desmarca um passo da checklist |
| `azy-board_check_items` | Marca/desmarca até 100 passos em massa |
| `azy-board_delete_checklist` | Exclui uma checklist |
| `azy-board_delete_checklist_item` | Exclui um passo da checklist |

## 🏃 Sprints

| Tool | Descrição |
|------|-----------|
| `azy-board_create_sprint` | Cria uma sprint com nome e datas |
| `azy-board_list_sprints` | Lista as sprints do projeto |
| `azy-board_get_current_sprint` | Retorna a sprint ativa (CURRENT) |
| `azy-board_update_sprint` | Edita nome e/ou datas de uma sprint |
| `azy-board_activate_sprint` | Ativa uma sprint |
| `azy-board_close_sprint` | Encerra uma sprint |
| `azy-board_prepare_sprint_transition` | Prepara plano de transição de sprint (somente leitura) |
| `azy-board_apply_sprint_transition` | Aplica plano de transição de sprint em transação atômica |

## 📦 Módulos

| Tool | Descrição |
|------|-----------|
| `azy-board_create_module` | Cria um módulo no projeto |
| `azy-board_list_modules` | Lista os módulos do projeto |
| `azy-board_update_module` | Renomeia um módulo (exige ADMIN) |

## 🏷️ Tags

| Tool | Descrição |
|------|-----------|
| `azy-board_create_tag` | Cria uma tag no projeto |
| `azy-board_list_tags` | Lista as tags do projeto |
| `azy-board_update_tag` | Edita nome e/ou cor de uma tag |
| `azy-board_set_item_tags` | Substitui as tags de um item pela lista informada |

## 📌 Versões

| Tool | Descrição |
|------|-----------|
| `azy-board_create_version` | Cria uma versão do projeto |
| `azy-board_list_versions` | Lista as versões do projeto |
| `azy-board_update_version` | Edita uma versão existente |

## 👥 Squads

| Tool | Descrição |
|------|-----------|
| `azy-board_create_squad` | Cria um squad no projeto |
| `azy-board_list_squads` | Lista os squads do projeto |
| `azy-board_update_squad` | Renomeia um squad (exige ADMIN) |

## 👤 Membros

| Tool | Descrição |
|------|-----------|
| `azy-board_add_member` | Adiciona membro ao projeto por e-mail |
| `azy-board_list_members` | Lista os membros do projeto |
| `azy-board_update_member` | Atualiza o papel de um membro |
| `azy-board_remove_member` | Remove um membro do projeto |
| `azy-board_set_member_squad` | Define, troca ou limpa o squad de um membro |

## 💰 Centro de Custo

| Tool | Descrição |
|------|-----------|
| `azy-board_create_cost_center` | Cria um centro de custo no projeto |
| `azy-board_list_cost_centers` | Lista os centros de custo do projeto |
| `azy-board_update_cost_center` | Edita código e/ou descrição de um centro de custo |

## 📎 Anexos

| Tool | Descrição |
|------|-----------|
| `azy-board_list_attachments` | Lista os anexos de um item |
| `azy-board_read_attachment` | Lê o conteúdo textual de um anexo (texto/Markdown/CSV/JSON) |

## 🔗 Links Externos

| Tool | Descrição |
|------|-----------|
| `azy-board_create_item_link` | Cria um link externo em um item |
| `azy-board_list_item_links` | Lista os links externos de um item |
| `azy-board_update_item_link` | Atualiza nome/URL/descrição de um link |
| `azy-board_delete_item_link` | Remove um link externo do item |

## ⏱️ Logs de Trabalho

| Tool | Descrição |
|------|-----------|
| `azy-board_create_item_log` | Registra um apontamento de trabalho no item |
| `azy-board_list_item_logs` | Lista os logs de trabalho de um item |
| `azy-board_update_item_log` | Atualiza texto e/ou duração de um log |

## 📊 Analytics / Relatórios

| Tool | Descrição |
|------|-----------|
| `azy-board_get_dashboard_metrics` | Métricas oficiais do Dashboard (snapshot, burnup, aging, hours, sprint) |
| `azy-board_query_planning_gaps` | Consulta itens por lacunas de planejamento |

## 🔧 Colunas

| Tool | Descrição |
|------|-----------|
| `azy-board_create_column` | Cria uma coluna no board |
| `azy-board_list_columns` | Lista as colunas do board com seus status base |
| `azy-board_reorder_columns` | Reordena as colunas do board |
| `azy-board_reorder_items` | Reordena os itens de uma coluna |

