## MODIFIED Requirements

### Requirement: Persistência de filtros no localStorage
O sistema SHALL armazenar o estado atual de filtros do board — incluindo `showSubtasks`, `storyDisplay`, `hideEmptyStories`, tags, versão, prioridade, status e autor — no `localStorage` do navegador sob a chave `board-filters:<projectId>`. A gravação SHALL ocorrer sempre que qualquer filtro ou opção de visualização for alterado. Os estados recolhidos de épicos e histórias SHALL ser armazenados separadamente.

#### Scenario: Filtros e toggles persistidos ao alterar qualquer controle
- **WHEN** o usuário altera qualquer filtro do board ou alterna `showSubtasks`, `storyDisplay`, `hideEmptyEpics` ou `hideEmptyStories`
- **THEN** o novo estado completo é gravado no `localStorage` sob a chave `board-filters:<projectId>`

#### Scenario: Novos filtros são persistidos
- **WHEN** o usuário altera tags, versão, prioridade, status ou autor
- **THEN** o valor selecionado é salvo no estado do projeto e restaurado na próxima visita

#### Scenario: Estado antigo sem novos filtros
- **WHEN** o valor persistido não contém tags, versão, prioridade, status ou autor
- **THEN** o sistema usa valores vazios para esses filtros e preserva os demais campos válidos

#### Scenario: Filtro de versão removido do projeto
- **WHEN** o estado persistido aponta para uma versão que não existe mais no projeto
- **THEN** o sistema limpa somente o filtro de versão e mantém os demais filtros

#### Scenario: Estado de swimlanes recolhidas persistido
- **WHEN** o usuário expande ou recolhe uma lane de épico ou história
- **THEN** os IDs recolhidos são gravados em `board-collapsed-epics:<projectId>` e `board-collapsed-stories:<projectId>`, respectivamente

#### Scenario: Filtros e toggles restaurados ao abrir o board
- **WHEN** o usuário navega para o board de um projeto
- **THEN** o sistema lê `board-filters:<projectId>` do `localStorage` e inicializa filtros e toggles com o estado persistido, sem flash de estado padrão

#### Scenario: Limpar filtros preserva toggles de visualização
- **WHEN** o usuário clica em "Limpar" na barra de filtros
- **THEN** os filtros de dados, incluindo tags, versão, prioridade, status e autor, são resetados para o estado padrão
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
