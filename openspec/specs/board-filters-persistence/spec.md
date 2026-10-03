## Purpose

Definir a persistência local, a restauração e a compatibilidade do estado visual e dos filtros do Board.
## Requirements
### Requirement: Persistência de filtros no localStorage
O sistema SHALL armazenar o estado atual de filtros do board — incluindo `showSubtasks`, `storyDisplay`, `hideEmptyStories`, Centro de Custo, sprint, tags, versão, prioridade, status e autor — no `localStorage` do navegador sob a chave `board-filters:<projectId>`. A gravação SHALL ocorrer sempre que qualquer filtro ou opção de visualização for alterado. O modo de visualização, a densidade, o módulo ativo e os estados recolhidos de épicos, módulos e histórias SHALL ser armazenados separadamente e sempre no escopo do projeto. Quando um filtro for removido pela linha de filtros ativos, somente seu valor SHALL ser alterado e a nova configuração SHALL ser persistida no mesmo projeto.

#### Scenario: Filtros e opções persistidos ao alterar qualquer controle
- **WHEN** o usuário altera qualquer filtro, alterna uma opção visual, muda modo, densidade ou módulo ativo
- **THEN** o estado completo correspondente é gravado no escopo do projeto atual

#### Scenario: Filtro removido pela linha de filtros ativos
- **WHEN** o usuário remove uma tag de filtro ativo
- **THEN** somente o filtro representado pela tag é limpo e o novo estado é gravado sob `board-filters:<projectId>`

#### Scenario: Filtros de conteúdo persistidos
- **WHEN** o usuário altera sprint, tags, versão, prioridade, status, autor ou Centro de Custo
- **THEN** os valores selecionados são salvos no projeto e restaurados na próxima visita

#### Scenario: Estado antigo sem novos filtros
- **WHEN** o valor persistido não contém filtros de conteúdo novos ou opções visuais novas
- **THEN** o sistema usa defaults somente para os campos ausentes e preserva os demais campos válidos

#### Scenario: Filtro relacionado removido do projeto
- **WHEN** o estado persistido aponta para sprint, versão, Centro de Custo ou módulo que não existe mais no projeto
- **THEN** o sistema limpa somente a referência inválida e mantém os demais filtros e opções

#### Scenario: Estado de swimlanes recolhidas persistido
- **WHEN** o usuário expande ou recolhe uma lane de épico, módulo ou história
- **THEN** os IDs recolhidos são gravados em chaves separadas do projeto correspondente

#### Scenario: Filtros e opções restaurados ao abrir o board
- **WHEN** o usuário navega para o Board de um projeto
- **THEN** o sistema lê todas as chaves do `projectId` e inicializa filtros, modo, densidade, módulo e toggles com o estado persistido sem flash de estado padrão

#### Scenario: Filtros independentes por projeto
- **WHEN** o usuário alterna entre projetos distintos
- **THEN** cada projeto restaura seus próprios filtros e preferências visuais sem interferência

#### Scenario: Fallback para estado corrompido ou storage indisponível
- **WHEN** qualquer valor não é JSON válido ou `localStorage` lança `SecurityError`
- **THEN** o sistema usa defaults por campo e o Board funciona normalmente sem erro visível

### Requirement: Preservação do filtro por valor vazio
O estado persistido em `board-filters:<projectId>` SHALL preservar o sentinela de valor vazio (`__empty__`) de cada campo. A restauração do Board SHALL manter o filtro por valor vazio, e a limpeza de referências de catálogo inexistentes SHALL NOT descartar o sentinela, pois ele não referencia um item de catálogo.

#### Scenario: Filtro por valor vazio restaurado ao abrir o board
- **WHEN** o usuário aplica `Sem sprint` e retorna ao Board do mesmo projeto
- **THEN** o filtro de Sprint é restaurado no estado de valor vazio e o Board filtra os cards sem sprint

#### Scenario: Invalidação de catálogo não descarta o sentinela
- **WHEN** o Board carrega e o valor persistido de Sprint é o sentinela de valor vazio
- **THEN** o sentinela é mantido, mesmo que não corresponda a nenhuma sprint do catálogo

#### Scenario: Sentinela não colide com referência de catálogo
- **WHEN** o estado persistido contém um valor que não é o sentinela e não existe no catálogo
- **THEN** somente esse valor inválido é limpo para o estado neutro

