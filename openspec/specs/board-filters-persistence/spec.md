## Purpose

Definir a persistência local, a restauração e a compatibilidade do estado visual e dos filtros do Board.

## Requirements

### Requirement: Persistência de filtros no localStorage
O sistema SHALL armazenar o estado atual de filtros do board — incluindo `showSubtasks`, `storyDisplay`, `hideEmptyStories`, Centro de Custo, sprint, tags, versão, prioridade, status e autor — no `localStorage` do navegador sob a chave `board-filters:<projectId>`. A gravação SHALL ocorrer sempre que qualquer filtro ou opção de visualização for alterado. Os estados recolhidos de épicos e histórias SHALL ser armazenados separadamente.

#### Scenario: Filtros e toggles persistidos ao alterar qualquer controle
- **WHEN** o usuário altera qualquer filtro do board ou alterna `showSubtasks`, `storyDisplay`, `hideEmptyEpics` ou `hideEmptyStories`
- **THEN** o novo estado completo é gravado no `localStorage` sob a chave `board-filters:<projectId>`

#### Scenario: Filtros de conteúdo persistidos
- **WHEN** o usuário altera sprint, tags, versão, prioridade, status, autor ou Centro de Custo
- **THEN** os valores selecionados são salvos no estado do projeto e restaurados na próxima visita

#### Scenario: Estado antigo sem novos filtros
- **WHEN** o valor persistido não contém filtros de conteúdo novos
- **THEN** o sistema usa valores vazios para esses filtros e preserva os demais campos válidos

#### Scenario: Filtro relacionado removido do projeto
- **WHEN** o estado persistido aponta para sprint, versão ou Centro de Custo que não existe mais no projeto
- **THEN** o sistema limpa somente o filtro inválido e mantém os demais filtros

#### Scenario: Estado de swimlanes recolhidas persistido
- **WHEN** o usuário expande ou recolhe uma lane de épico ou história
- **THEN** os IDs recolhidos são gravados em `board-collapsed-epics:<projectId>` e `board-collapsed-stories:<projectId>`, respectivamente

#### Scenario: Filtros e toggles restaurados ao abrir o board
- **WHEN** o usuário navega para o board de um projeto
- **THEN** o sistema lê `board-filters:<projectId>` do `localStorage` e inicializa filtros e toggles com o estado persistido, sem flash de estado padrão

#### Scenario: Swimlanes recolhidas restauradas ao abrir o board
- **WHEN** o usuário navega para o board de um projeto
- **THEN** o sistema lê `board-collapsed-epics:<projectId>` e `board-collapsed-stories:<projectId>`
- **AND** inicializa separadamente os conjuntos de lanes de épicos e histórias recolhidas

#### Scenario: Retrocompatibilidade com estado salvo antes das lanes de história
- **WHEN** o valor persistido contém o antigo campo `showStories` e não contém `storyDisplay`
- **THEN** o sistema ignora `showStories` e aplica `storyDisplay: lanes`

#### Scenario: Histórias como lanes por padrão
- **WHEN** o usuário abre o board de um projeto sem entrada no `localStorage`
- **THEN** os filtros são inicializados com `storyDisplay: lanes`, `hideEmptyStories: false` e `showSubtasks: false`

#### Scenario: Limpar filtros preserva toggles de visualização
- **WHEN** o usuário clica em "Limpar" na barra de filtros
- **THEN** os filtros de dados, incluindo sprint, tags, versão, prioridade, status, autor e Centro de Custo, são resetados para o estado padrão
- **AND** `showSubtasks` e `storyDisplay` são mantidos com seus valores atuais

#### Scenario: Filtros independentes por projeto
- **WHEN** o usuário alterna entre projetos distintos
- **THEN** cada projeto restaura seus próprios filtros do `localStorage`, sem interferência entre projetos

#### Scenario: Fallback para estado padrão em caso de dado corrompido
- **WHEN** o valor em `localStorage` para qualquer chave de filtros não é um JSON válido
- **THEN** o sistema ignora o valor inválido e usa o estado padrão, sem lançar erro visível

#### Scenario: localStorage indisponível
- **WHEN** o `localStorage` lança `SecurityError` (ex.: modo privativo agressivo)
- **THEN** o sistema usa o estado padrão de filtros e o board funciona normalmente, sem persistência
