## ADDED Requirements

### Requirement: Menu separado de opções do board

O Board SHALL exibir um botão `Opções` separado do botão `Filtros`. O menu `Opções` SHALL conter somente controles de visualização, incluindo Hierarquia/Abas, subtasks, histórias, ocultação de lanes vazias e expansão/colapso.

#### Scenario: Abrir opções

- **WHEN** o usuário clica no botão `Opções`
- **THEN** o menu de opções é aberto sem misturar filtros de dados

#### Scenario: Filtros separados

- **WHEN** o usuário clica no botão `Filtros`
- **THEN** o menu exibe apenas filtros de dados como módulo, sprint, responsável, squad, tipo e tags

#### Scenario: Menus mutuamente exclusivos

- **WHEN** um menu está aberto e o usuário abre o outro
- **THEN** o menu anterior é fechado

### Requirement: Opções preservam estado do board

As opções movidas para o menu `Opções` SHALL continuar atualizando o mesmo estado persistido do board sem limpar ou alterar filtros de dados.

#### Scenario: Alternar modo de módulos

- **WHEN** o usuário troca entre Hierarquia e Abas no menu Opções
- **THEN** `moduleViewMode` é atualizado e a preferência continua persistida por projeto

#### Scenario: Limpar filtros de dados

- **WHEN** o usuário limpa os filtros pelo menu Filtros
- **THEN** filtros de conteúdo são removidos e as opções de visualização permanecem inalteradas
