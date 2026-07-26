## Purpose

Definir o comportamento de histórias folha no modo alternativo de histórias como cards.

## Requirements

### Requirement: STORY folha é card arrastável no Kanban
O sistema SHALL tratar uma STORY sem tarefas filhas (`isLeaf = true`) como card arrastável somente quando `storyDisplay = cards`. O card SHALL possuir um `columnId` e um `status` que mudam conforme o card é movido entre colunas, exatamente como uma TASK ou BUG. Quando `storyDisplay = lanes`, a mesma STORY SHALL permanecer como lane, mesmo vazia.

#### Scenario: História folha aparece como card real na primeira coluna
- **WHEN** `storyDisplay = cards` e uma STORY não possui nenhuma tarefa filha
- **THEN** a STORY aparece como card com ID verdadeiro (não prefixado) na primeira coluna do board caso ainda não possua `columnId` definido

#### Scenario: História folha exibe handle de arrastar
- **WHEN** uma STORY folha é exibida como card
- **THEN** o card exibe o handle de arrastar (cursor grab) e pode ser iniciado via drag com threshold de 5px

#### Scenario: Mover história folha para outra coluna
- **WHEN** o usuário arrasta uma STORY folha e a solta em outra coluna
- **THEN** o sistema chama `PATCH /projects/:projectId/items/:itemId/move` com o `columnId` da coluna destino
- **AND** o `status` da história é atualizado para o `baseStatus` da coluna destino
- **AND** o card aparece na nova coluna imediatamente (atualização otimista)

#### Scenario: Clicar em card de história folha abre StoryModal
- **WHEN** o usuário clica no card de uma STORY folha no board
- **THEN** o `StoryModal` é aberto com os dados da história (título, épico pai, campos ágeis)

#### Scenario: História folha com columnId null exibida na col[0]
- **WHEN** uma STORY folha não possui `columnId` definido no banco
- **THEN** o frontend renderiza o card na primeira coluna sem chamar a API
- **AND** o banco é atualizado apenas quando o usuário move o card explicitamente

#### Scenario: História com tarefas filhas não é arrastável
- **WHEN** `storyDisplay = cards` e uma STORY possui pelo menos uma tarefa filha (`isLeaf = false`)
- **THEN** a STORY continua sendo exibida como card virtual não-arrastável (prefixo `story-virtual-*`) na primeira coluna

#### Scenario: História folha permanece lane no modo padrão
- **WHEN** `storyDisplay = lanes` e uma STORY não possui filhos
- **THEN** a STORY é exibida como lane vazia com as colunas disponíveis
- **AND** não recebe handle de arrastar

#### Scenario: API rejeita mover STORY não-folha
- **WHEN** uma requisição `PATCH /projects/:projectId/items/:itemId/move` é feita para uma STORY que possui filhos
- **THEN** a API retorna HTTP 422 com mensagem de erro indicando que o item possui tarefas filhas

#### Scenario: API aceita mover STORY folha
- **WHEN** uma requisição `PATCH /projects/:projectId/items/:itemId/move` é feita para uma STORY sem filhos (`isLeaf = true`)
- **THEN** a API atualiza `columnId` e `status` da história e retorna HTTP 200 com o novo status

#### Scenario: Filtros de módulo e responsável se aplicam a histórias folha
- **WHEN** filtros de módulo, responsável ou squad estão ativos no board
- **THEN** histórias folha são filtradas pelos mesmos critérios que TASK/BUG (exceto filtro de tipo, que não se aplica a STORY)
