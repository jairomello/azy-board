## Why

Com o crescimento dos projetos no Azy Board, surgem necessidades de gestão mais sofisticadas: rastreabilidade financeira por centro de custo, identificação clara do responsável pelo projeto, organização de equipe por squads com papéis definidos, e mecanismos para manter o board limpo e navegável (arquivamento de cards antigos e ocultação de épicos vazios). Essas melhorias tornam o Azy Board adequado para times maiores e projetos com requisitos de governança.

## What Changes

- **Centros de custo por projeto**: cada projeto pode cadastrar N centros de custo (código varchar(20) + descrição varchar(200)); toda task/subtask/bug pode ter um centro de custo associado; quando existem centros de custo, o primeiro da lista é atribuído automaticamente na criação; campo não obrigatório; alterável via combo na modal de criação/edição.
- **Gerente Geral do Projeto**: campo na criação do projeto e nas configurações para indicar um usuário como gerente; apenas papel informativo/exibição (sem RBAC especial nesta versão).
- **Membros e Squads redesenhados**: separação clara entre squads e membros; cada membro tem squad (opcional) e papel (ADMIN / MEMBER / VIEWER); squads têm apenas nome e podem ser criadas/editadas/excluídas; UI reorganizada com botão explícito para adicionar membros.
- **Status Arquivado para cards**: novo status `archived`; cards arquivados são ocultos do board e da árvore hierárquica; arquivar um nó da árvore arquiva todos os descendentes em cascata; botão "Ver itens arquivados" abre modal com lista e opção de desarquivar; ao desarquivar, o card retorna ao status que tinha antes do arquivamento.
- **Filtro "Ocultar épicos vazios"**: toggle nos filtros do board que esconde épicos sem nenhum card visível (não arquivado) dentro; padrão desligado.

## Capabilities

### New Capabilities

- `project-cost-centers`: Cadastro e gestão de centros de custo por projeto; associação automática e manual de centro de custo em tasks/subtasks/bugs.
- `card-archive`: Status "Arquivado" com ocultação do board/árvore, arquivamento em cascata pela hierarquia e modal de itens arquivados com restauração.

### Modified Capabilities

- `project-management`: Adição do campo Gerente Geral do Projeto na criação e nas configurações.
- `project-members-ui`: Redesenho completo da seção Membros & Squads — separação visual, campo de squad e papel por membro, gestão independente de squads.
- `board-filters`: Adição do toggle "Ocultar épicos vazios" na barra de filtros.

## Impact

- **Banco de dados**: novas tabelas `project_cost_centers` e atualização de `unified_items` (campos `cost_center_id`, `status_before_archive`); atualização de `projects` (campo `manager_user_id`); atualização de `project_members` (campos `squad_id`, `role`); nova tabela `project_squads`.
- **Backend**: novos endpoints REST para CRUD de centros de custo e squads; endpoint de arquivamento em cascata; endpoint de listagem de arquivados e restauração.
- **Frontend**: modal de projeto (novo campo gerente); settings do projeto (gerente, centros de custo, redesenho de membros/squads); modais de task/subtask/bug (combo centro de custo); barra de filtros (toggle épicos vazios); botão e modal de itens arquivados.
- **Multi-tenancy**: todas as novas tabelas incluem `tenant_id` com `withTenant()` obrigatório.
- **Leaf Rule**: arquivamento respeita a regra — ao arquivar um nó pai, todos os filhos (inclusive cards folha no board) são arquivados.
