## MODIFIED Requirements

### Requirement: Tree View lê recursivamente da tabela `items`
O sistema SHALL renderizar a Tree View como tabela hierárquica expansível lendo todos os itens de `GET /projects/:id/items/tree`, que retorna a árvore completa EPIC → STORY → TASK/BUG → subtask. A rota `/projects/:id/tree` é substituída por `/projects/:id/items/tree`.

#### Scenario: Alternar para Tree View
- **WHEN** usuário clica no botão "Árvore" no seletor de visualização
- **THEN** board Kanban desaparece e é substituído pela Tree View com dados de `GET /projects/:id/items/tree`

#### Scenario: Estrutura hierárquica exibida
- **WHEN** Tree View é carregada
- **THEN** raiz exibe módulos; cada módulo expande para EPICs; cada EPIC para STORYs; cada STORY para TASK/BUGs; cada TASK/BUG para subtasks (se houver)

#### Scenario: Ícone de tipo em cada nó
- **WHEN** nó é exibido na Tree View
- **THEN** ícone correspondente ao `type` (EPIC, STORY, TASK, BUG) é exibido antes do título do nó

#### Scenario: Expandir e colapsar nós
- **WHEN** usuário clica no ícone de expandir/colapsar de um nó
- **THEN** filhos do nó são exibidos ou ocultados; demais nós permanecem no estado atual

#### Scenario: Botões Expandir tudo / Recolher tudo
- **WHEN** usuário clica em "Expandir tudo"
- **THEN** todos os nós da árvore são expandidos simultaneamente

#### Scenario: Retornar ao Kanban
- **WHEN** usuário clica no botão "Kanban" no seletor de visualização
- **THEN** Tree View é substituída pelo board Kanban com filtros anteriores preservados

---

### Requirement: Colunas de dados na Tree View
O sistema SHALL exibir as seguintes colunas para cada item: Nome (com ícone de tipo), Status, Responsável, Data de Início, Data de Fim, Pontos, Progresso (%).

#### Scenario: Progresso de items pai na Tree View
- **WHEN** item pai (EPIC, STORY ou TASK/BUG com filhos) é exibido na Tree View
- **THEN** coluna Progresso exibe porcentagem calculada com barra visual

#### Scenario: Status de items folha
- **WHEN** item folha TASK ou BUG é exibido na Tree View
- **THEN** coluna Status exibe o status base atual com indicador visual colorido

#### Scenario: Pontos na Tree View
- **WHEN** item é exibido na Tree View
- **THEN** coluna Pontos exibe o valor da task folha ou a soma calculada para items pai

---

### Requirement: Edição inline na Tree View
O sistema SHALL permitir editar campos diretamente na tabela via `PATCH /projects/:id/items/:id`.

#### Scenario: Edição de título inline
- **WHEN** usuário clica no título de um item na Tree View
- **THEN** título torna-se campo de texto editável in-place

#### Scenario: Alteração de responsável inline
- **WHEN** usuário clica na coluna Responsável de um item
- **THEN** dropdown de membros do projeto é exibido para seleção

---

### Requirement: Filtros na Tree View
O sistema SHALL aplicar os mesmos filtros do Kanban (módulo, sprint, responsável, tags) à Tree View via `GET /projects/:id/items/tree` com os mesmos query params.

#### Scenario: Filtro por responsável na Tree View
- **WHEN** usuário seleciona um membro no filtro
- **THEN** Tree View exibe apenas itens atribuídos a esse membro, mantendo a hierarquia visível mas esmaecendo nós sem itens correspondentes

---

### Requirement: Navegação entre Kanban e Tree View preserva filtros
O sistema SHALL manter os filtros aplicados ao alternar entre Kanban e Tree View.

#### Scenario: Troca de visualização com filtro ativo
- **WHEN** usuário troca de Kanban para Tree View com filtro de módulo ativo
- **THEN** Tree View inicia já filtrada pelo mesmo módulo
