## ADDED Requirements

### Requirement: Criar e gerenciar módulos dentro de um projeto
O sistema SHALL permitir que administradores criem, renomeiem, reordenem e excluam módulos dentro de um projeto. O módulo é o segundo nível da hierarquia (`Project → Module`) e serve como agrupador lógico e funcional.

#### Scenario: Criação de módulo
- **WHEN** admin cria um módulo com nome e descrição opcional
- **THEN** sistema registra o módulo vinculado ao projeto e disponibiliza-o como filtro no board

#### Scenario: Reordenação de módulos
- **WHEN** admin reordena módulos na configuração do projeto
- **THEN** nova ordem é persistida e refletida na ordem do filtro de módulos no board

#### Scenario: Exclusão de módulo com epics vinculados
- **WHEN** admin tenta excluir módulo que contém epics
- **THEN** sistema solicita confirmação e, se confirmado, move os epics para um módulo destino especificado pelo admin antes de excluir

---

### Requirement: Filtro do board por módulo
O sistema SHALL permitir filtrar o board para exibir apenas cards pertencentes a um módulo específico.

#### Scenario: Filtro por módulo aplicado
- **WHEN** usuário seleciona um módulo no filtro do board
- **THEN** board exibe apenas swimlanes e cards cujos epics pertencem ao módulo selecionado

#### Scenario: Filtro "Todos os módulos"
- **WHEN** usuário seleciona "Todos" no filtro de módulos
- **THEN** board exibe todos os cards de todos os módulos do projeto

---

### Requirement: Associação de épicos a módulos
O sistema SHALL exigir que todo épico seja associado a um módulo no momento da criação.

#### Scenario: Criação de épico com módulo
- **WHEN** membro cria épico selecionando um módulo pai
- **THEN** épico é vinculado ao módulo e aparece na swimlane dentro do contexto do módulo

#### Scenario: Épico sem módulo
- **WHEN** projeto não possui módulos cadastrados
- **THEN** sistema cria automaticamente um módulo padrão chamado "Geral" para receber os épicos
