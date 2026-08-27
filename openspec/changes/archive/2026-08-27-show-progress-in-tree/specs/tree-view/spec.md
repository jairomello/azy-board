## MODIFIED Requirements

### Requirement: Colunas de dados na Tree View
O sistema SHALL exibir as seguintes colunas para cada item: Nome (com ícone de tipo), Status, Responsável, Data de Início, Data de Fim, Pontos, Progresso (%). A coluna Progresso SHALL exibir uma barra visual e o percentual numérico calculado para folhas e items agrupadores.

#### Scenario: Progresso de items pai na Tree View
- **WHEN** item pai (EPIC, STORY ou TASK/BUG com filhos) é exibido na Tree View
- **THEN** coluna Progresso exibe porcentagem acumulada calculada pelas folhas TASK/BUG descendentes com barra visual

#### Scenario: Progresso de item folha
- **WHEN** item folha TASK ou BUG é exibido na Tree View
- **THEN** coluna Progresso exibe 100% se o status for DONE e 0% caso contrário

#### Scenario: Status de items folha
- **WHEN** item folha TASK ou BUG é exibido na Tree View
- **THEN** coluna Status exibe o status base atual com indicador visual colorido

#### Scenario: Pontos na Tree View
- **WHEN** item é exibido na Tree View
- **THEN** coluna Pontos exibe o valor da task folha ou a soma calculada para items pai

### Requirement: Filtros na Tree View
O sistema SHALL aplicar os mesmos filtros do Kanban (módulo, sprint, responsável, tags) à Tree View via `GET /projects/:id/items/tree` com os mesmos query params. O progresso SHALL ser recalculado sobre o resultado filtrado.

#### Scenario: Filtro por responsável na Tree View
- **WHEN** usuário seleciona um membro no filtro
- **THEN** Tree View exibe apenas itens atribuídos a esse membro, mantendo a hierarquia visível mas esmaecendo nós sem itens correspondentes

#### Scenario: Progresso reflete filtro na Tree View
- **WHEN** usuário filtra a árvore por sprint ou responsável
- **THEN** barras dos agrupadores refletem somente as folhas que permanecem no resultado filtrado
