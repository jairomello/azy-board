## ADDED Requirements

### Requirement: Módulo como nível visual collapsível no board
O sistema SHALL renderizar módulos como swimlanes collapsíveis de nível superior no board, agrupando os épicos que lhes pertencem. A hierarquia visual SHALL ser: Módulo (swimlane) >> Épico (swimlane) >> História (lane) >> Cards.

#### Scenario: Módulos exibidos como swimlanes de nível superior
- **WHEN** board é renderizado e o projeto possui módulos com épicos
- **THEN** cada módulo com épicos é exibido como uma swimlane collapsível com seu nome no header, agrupando os épicos que lhe pertencem

#### Scenario: Módulo collapsível
- **WHEN** usuário clica no header de uma ModuleSwimlane
- **THEN** a ModuleSwimlane expande ou colapsa, mostrando ou ocultando os épicos dentro dela
- **AND** o estado de expansão é persistido por módulo

#### Scenario: Módulo sem épicos oculto no board
- **WHEN** um módulo não possui épicos vinculados
- **THEN** o módulo NÃO é exibido como swimlane no board (módulos vazios são gerenciados apenas via Settings)

#### Scenario: Épicos sem módulo (módulo "Geral")
- **WHEN** épicos não possuem `moduleId` definido
- **THEN** esses épicos são agrupados em uma ModuleSwimlane chamada "Sem módulo" ou "Geral", exibida por primeira no board

#### Scenario: Ordenação de módulos no board
- **WHEN** board é renderizado com múltiplos módulos
- **THEN** as ModuleSwimlanes são ordenadas pela posição do módulo (campo `position`), conforme definido em Settings

#### Scenario: Header da ModuleSwimlane exibe contagem
- **WHEN** ModuleSwimlane é renderizada
- **THEN** o header exibe o nome do módulo e a contagem de épicos vinculados (ex.: "Módulo X · 3 épicos")

#### Scenario: Estilo visual distinto para ModuleSwimlane
- **WHEN** ModuleSwimlane é renderizada
- **THEN** o header usa um estilo visual mais neutro/sutil que o header de Épico, com indentação menor, para diferenciar os níveis hierárquicos
