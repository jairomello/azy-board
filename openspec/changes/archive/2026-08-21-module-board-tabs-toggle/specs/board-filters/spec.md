## MODIFIED Requirements

### Requirement: Filtros e visualização do board

O sistema SHALL permitir configurar filtros de conteúdo e o modo de apresentação dos módulos no painel de filtros do Board. O modo SHALL aceitar `Hierarquia` ou `Abas`, usar `Hierarquia` quando não houver preferência salva e persistir a escolha por projeto junto aos demais filtros.

#### Scenario: Controle de modo disponível no Board

- **WHEN** o usuário abre o painel de filtros enquanto a visualização é `kanban`
- **THEN** o painel exibe as opções `Hierarquia` e `Abas`

#### Scenario: Controle oculto na árvore

- **WHEN** o usuário está na visualização `tree`
- **THEN** o controle específico de apresentação de módulos não altera a visualização da árvore

#### Scenario: Preferência persistida

- **WHEN** o usuário seleciona um modo e recarrega o projeto
- **THEN** o Board restaura o modo selecionado para aquele projeto

#### Scenario: Filtros existentes preservados

- **WHEN** o usuário alterna entre `Hierarquia` e `Abas`
- **THEN** os filtros de módulo, sprint, responsável, squad, tipos, tags e opções de histórias permanecem aplicados
