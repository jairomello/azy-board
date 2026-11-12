# Spec Delta

## ADDED Requirements

### Requirement: Ação de limpar filtros visível com contador
O sistema SHALL exibir a ação de limpar filtros de forma visível no board e na Tree View quando houver filtros ativos, acompanhada da contagem de filtros ativos. A ação SHALL limpar os filtros de população e as ocultações de lanes vazias, SHALL preservar `showSubtasks`, `storyDisplay`, `moduleViewMode` e o modo de visualização atual, e SHALL atualizar o `localStorage`.

#### Scenario: Contador acompanha filtros ativos
- **WHEN** o usuário ativa filtros de conteúdo
- **THEN** a ação de limpar exibe a contagem de filtros ativos

#### Scenario: Limpar pela command bar
- **WHEN** o usuário aciona limpar filtros na command bar do board
- **THEN** os filtros de conteúdo são removidos e as preferências de exibição permanecem

#### Scenario: Limpar na Tree View
- **WHEN** o usuário aciona limpar filtros na Tree View
- **THEN** os filtros são removidos e a visualização continua na Tree View

#### Scenario: Sem filtros ativos
- **WHEN** não há filtros aplicados
- **THEN** a ação de limpar não é exibida ou fica desabilitada
