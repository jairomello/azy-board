## MODIFIED Requirements

### Requirement: Persistência de filtros no localStorage
O sistema SHALL armazenar o estado atual de filtros do board — incluindo toggles de visualização (`showSubtasks`, `showStories`) — no `localStorage` do navegador sob a chave `board-filters:<projectId>`. A gravação SHALL ocorrer sempre que qualquer filtro ou toggle for alterado. O estado de swimlanes recolhidas SHALL ser armazenado separadamente sob a chave `board-collapsed-epics:<projectId>`.

#### Scenario: Filtros e toggles persistidos ao alterar qualquer controle
- **WHEN** o usuário altera qualquer filtro do board (squad, módulo, sprint, responsável, tipos, tags) ou qualquer toggle de visualização (showSubtasks, showStories, hideEmptyEpics)
- **THEN** o novo estado completo é gravado no `localStorage` sob a chave `board-filters:<projectId>`

#### Scenario: Estado de swimlanes recolhidas persistido
- **WHEN** o usuário expande ou recolhe uma swimlane de épico
- **THEN** o conjunto de IDs de épicos recolhidos é gravado no `localStorage` sob a chave `board-collapsed-epics:<projectId>`

#### Scenario: Filtros e toggles restaurados ao abrir o board
- **WHEN** o usuário navega para o board de um projeto
- **THEN** o sistema lê `board-filters:<projectId>` do `localStorage` e inicializa filtros e toggles com o estado persistido, sem flash de estado padrão

#### Scenario: Swimlanes recolhidas restauradas ao abrir o board
- **WHEN** o usuário navega para o board de um projeto
- **THEN** o sistema lê `board-collapsed-epics:<projectId>` e inicializa o conjunto de swimlanes recolhidas com os IDs persistidos

#### Scenario: Retrocompatibilidade com estado salvo sem toggles de visualização
- **WHEN** o valor em `localStorage` para `board-filters:<projectId>` não contém `showSubtasks` ou `showStories` (salvo antes desta mudança)
- **THEN** o sistema faz merge do estado salvo com os valores padrão de `DEFAULT_FILTERS`, resultando em `showSubtasks: false` e `showStories: true`

#### Scenario: showStories ativo por padrão em board novo
- **WHEN** o usuário abre o board de um projeto sem entrada no `localStorage`
- **THEN** os filtros são inicializados com `DEFAULT_FILTERS`, incluindo `showStories: true` e `showSubtasks: false`

#### Scenario: Limpar filtros preserva toggles de visualização
- **WHEN** o usuário clica em "Limpar" na barra de filtros
- **THEN** os filtros de dados (módulo, sprint, responsável, squad, tipos, tags, hideEmptyEpics) são resetados para o estado padrão
- **AND** os toggles `showSubtasks` e `showStories` são mantidos com seus valores atuais

#### Scenario: Filtros independentes por projeto
- **WHEN** o usuário alterna entre projetos distintos
- **THEN** cada projeto restaura seus próprios filtros do `localStorage`, sem interferência entre projetos

#### Scenario: Fallback para estado padrão em caso de dado corrompido
- **WHEN** o valor em `localStorage` para qualquer chave de filtros não é um JSON válido
- **THEN** o sistema ignora o valor inválido e usa o estado padrão, sem lançar erro visível

#### Scenario: localStorage indisponível
- **WHEN** o `localStorage` lança `SecurityError` (ex.: modo privativo agressivo)
- **THEN** o sistema usa o estado padrão de filtros e o board funciona normalmente, sem persistência
