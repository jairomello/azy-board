## ADDED Requirements

### Requirement: Tree View — visão alternativa ao Kanban
O sistema SHALL oferecer uma visão alternativa ao Kanban em formato de tabela hierárquica expansível, exibindo toda a estrutura do projeto do nível de módulo até subtasks.

#### Scenario: Acesso à Tree View
- **WHEN** usuário seleciona "Tree View" no seletor de visualização do projeto
- **THEN** sistema exibe a tabela hierárquica substituindo o board Kanban

#### Scenario: Estrutura da Tree View
- **WHEN** Tree View é carregada
- **THEN** raiz exibe os módulos do projeto; cada módulo expande para épicos; cada épico para stories; cada story para tasks; cada task para subtasks

---

### Requirement: Expansão e colapso de nós na Tree View
O sistema SHALL permitir expandir e colapsar qualquer nó da hierarquia na Tree View individualmente.

#### Scenario: Expandir nó
- **WHEN** usuário clica no ícone de expandir de um nó (ex: épico)
- **THEN** sistema exibe os filhos diretos daquele nó na tabela

#### Scenario: Colapsar nó
- **WHEN** usuário clica no ícone de colapsar de um nó expandido
- **THEN** sistema oculta todos os descendentes daquele nó

#### Scenario: Expandir tudo / Colapsar tudo
- **WHEN** usuário clica em "Expandir tudo" no toolbar da Tree View
- **THEN** todos os nós são expandidos simultaneamente

---

### Requirement: Colunas de dados na Tree View
O sistema SHALL exibir as seguintes colunas para cada item na Tree View: Nome, Status, Responsável, Data de Início, Data de Fim, Pontos, Progresso (%).

#### Scenario: Progresso de tasks pai na Tree View
- **WHEN** task pai é exibida na Tree View
- **THEN** coluna Progresso exibe porcentagem calculada com barra visual

#### Scenario: Status de tasks folha
- **WHEN** task folha é exibida na Tree View
- **THEN** coluna Status exibe o status base atual (NOT_STARTED, IN_PROGRESS, BLOCKED, DONE, CANCELLED) com indicador visual colorido

#### Scenario: Pontos na Tree View
- **WHEN** item é exibido na Tree View
- **THEN** coluna Pontos exibe o valor da task folha ou a soma calculada para tasks pai, story e épico

---

### Requirement: Edição inline na Tree View
O sistema SHALL permitir editar campos diretamente na tabela da Tree View sem abrir modal.

#### Scenario: Edição de título inline
- **WHEN** usuário clica no título de um item na Tree View
- **THEN** título torna-se campo de texto editável in-place

#### Scenario: Alteração de responsável inline
- **WHEN** usuário clica na coluna Responsável de uma task
- **THEN** dropdown de membros do projeto é exibido para seleção

---

### Requirement: Filtros na Tree View
O sistema SHALL aplicar os mesmos filtros disponíveis no Kanban (módulo, sprint, responsável, tags) à Tree View.

#### Scenario: Filtro por responsável na Tree View
- **WHEN** usuário seleciona um membro no filtro de responsável
- **THEN** Tree View exibe apenas itens atribuídos a esse membro, mantendo a hierarquia visível mas esmaecendo nós sem itens correspondentes

---

### Requirement: Navegação entre Kanban e Tree View preserva filtros
O sistema SHALL manter os filtros aplicados ao alternar entre Kanban e Tree View.

#### Scenario: Troca de visualização com filtro ativo
- **WHEN** usuário troca de Kanban para Tree View com filtro de módulo ativo
- **THEN** Tree View inicia já filtrada pelo mesmo módulo
