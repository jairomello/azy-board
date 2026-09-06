## MODIFIED Requirements

### Requirement: Persistência de filtros no localStorage
O sistema SHALL armazenar o estado atual de filtros do board — incluindo `showSubtasks`, `storyDisplay`, `hideEmptyStories`, Centro de Custo, sprint, tags, versão, prioridade, status e autor — no `localStorage` do navegador sob a chave `board-filters:<projectId>`. A gravação SHALL ocorrer sempre que qualquer filtro ou opção de visualização for alterado. Os estados recolhidos de épicos e histórias SHALL ser armazenados separadamente. Quando um filtro for removido pela linha de filtros ativos, somente seu valor SHALL ser alterado e a nova configuração SHALL ser persistida no mesmo projeto.

#### Scenario: Filtros e toggles persistidos ao alterar qualquer controle
- **WHEN** o usuário altera qualquer filtro do board ou alterna `showSubtasks`, `storyDisplay`, `hideEmptyEpics` ou `hideEmptyStories`
- **THEN** o novo estado completo é gravado no `localStorage` sob a chave `board-filters:<projectId>`

#### Scenario: Filtro removido pela linha de filtros ativos
- **WHEN** o usuário remove uma tag de filtro ativo
- **THEN** somente o filtro representado pela tag é limpo e o novo estado é gravado sob `board-filters:<projectId>`

#### Scenario: Filtros independentes por projeto
- **WHEN** o usuário alterna entre projetos distintos
- **THEN** cada projeto restaura seus próprios filtros do `localStorage`, sem interferência entre projetos

#### Scenario: Fallback para estado padrão em caso de dado corrompido
- **WHEN** o valor persistido não é um JSON válido
- **THEN** o sistema ignora o valor inválido e usa o estado padrão, sem lançar erro visível
