## MODIFIED Requirements

### Requirement: Filtros e opções no toolbar do board
O sistema SHALL exibir filtros de conteúdo em um painel acionado pelo botão `Filtros` da command bar. O painel SHALL conter Squad, Módulo, Sprint, Responsável, Autor, Centro de Custo, Versão, Prioridade, Status, tipos e tags. Os filtros de Sprint, Versão, Responsável, Autor e Centro de Custo SHALL oferecer duas opções distintas de estado vazio: uma opção neutra de "sem filtro" (`value=""`), rotulada com o nome do campo ou `Todas`, e uma opção de valor vazio (`value="__empty__"`), rotulada `Sem sprint`, `Sem versão`, `Não atribuído`, `Sem autor` e `Sem centro de custo`, respectivamente. Quando não houver itens de catálogo, os controles SHALL permanecer visíveis exibindo a indicação neutra, sem permitir seleção de valor vazio inexistente. Sprint SHALL listar `PROPOSED`, `OPEN` e `CLOSED` quando houver sprints. Os controles de visualização SHALL estar no painel separado `Opções`.

#### Scenario: Filtro por módulo
- **WHEN** o usuário seleciona um módulo no painel Filtros
- **THEN** apenas cards cujos épicos pertencem ao módulo selecionado são exibidos

#### Scenario: Filtro por sprint
- **WHEN** o usuário seleciona um sprint no painel Filtros
- **THEN** apenas cards associados ao sprint selecionado são exibidos

#### Scenario: Filtro por responsável
- **WHEN** o usuário seleciona um responsável no painel Filtros
- **THEN** apenas cards atribuídos ao responsável selecionado são exibidos

#### Scenario: Filtro por autor
- **WHEN** o usuário seleciona um autor no painel Filtros
- **THEN** apenas cards cujo `authorId` corresponde ao autor selecionado são exibidos

#### Scenario: Filtro por Centro de Custo
- **WHEN** o usuário seleciona um Centro de Custo no painel Filtros
- **THEN** apenas itens cujo `costCenterId` corresponde ao Centro selecionado são exibidos

#### Scenario: Filtro por versão
- **WHEN** o usuário seleciona uma versão no painel Filtros
- **THEN** apenas itens cujo `versionId` corresponde à versão selecionada são exibidos

#### Scenario: Filtro por prioridade ou status
- **WHEN** o usuário seleciona uma prioridade ou status no painel Filtros
- **THEN** apenas cards com o valor selecionado são exibidos

#### Scenario: Filtro por tipo de card
- **WHEN** o usuário seleciona um ou mais tipos (`TASK`, `BUG`) no painel Filtros
- **THEN** apenas cards dos tipos selecionados são exibidos

#### Scenario: Filtro por tag
- **WHEN** o usuário seleciona uma ou mais tags no painel Filtros
- **THEN** apenas cards que possuem pelo menos uma das tags selecionadas são exibidos

#### Scenario: Filtros sem cadastro
- **WHEN** o usuário abre o painel em projeto sem Centros de Custo, versões ou sprints
- **THEN** os controles permanecem visíveis com suas indicações neutras e sem opção de valor vazio selecionável

#### Scenario: Filtro de sprint fechada para consulta histórica
- **WHEN** o usuário seleciona uma sprint `CLOSED`
- **THEN** o Board exibe os cards historicamente associados sem permitir novas associações

#### Scenario: Múltiplos filtros ativos
- **WHEN** mais de um filtro está ativo simultaneamente
- **THEN** os filtros são combinados com AND entre dimensões e OR entre tags selecionadas da mesma dimensão

#### Scenario: Item sem vínculo correspondente
- **WHEN** um filtro de Centro de Custo, versão, autor ou tag está ativo e um item não possui esse vínculo
- **THEN** o item não é exibido

#### Scenario: Filtros no modo simples
- **WHEN** o usuário aplica filtros em projeto `SIMPLE`
- **THEN** os filtros compatíveis continuam filtrando os cards do fluxo único sem exigir módulo ou épico

#### Scenario: Limpar filtros
- **WHEN** o usuário clica em "Limpar filtros" no painel Filtros
- **THEN** filtros de conteúdo e ocultações de lanes vazias são removidos
- **AND** `showSubtasks`, `storyDisplay` e `moduleViewMode` são preservados
- **AND** o `localStorage` é atualizado

#### Scenario: Indicador de filtro ativo
- **WHEN** pelo menos um filtro de conteúdo está ativo
- **THEN** um indicador visual (contagem ou ponto) é exibido no botão Filtros

#### Scenario: Alternar modo de módulos
- **WHEN** o usuário alterna entre `Hierarquia` e `Abas` no painel Opções
- **THEN** o Board preserva os filtros aplicados e restaura o modo selecionado ao recarregar o projeto

## ADDED Requirements

### Requirement: Filtro por valor vazio em campos anuláveis
O Board SHALL permitir filtrar cards pelos campos anuláveis Sprint, Versão, Responsável, Autor e Centro de Custo no estado "sem valor", usando um sentinela distinto do estado neutro `''`. O filtro por valor vazio SHALL ser aplicado client-side sobre os itens carregados. Campos `NOT NULL` (`priority`, `status`, `type`) SHALL NOT oferecer opção de valor vazio.

#### Scenario: Filtrar cards sem sprint
- **WHEN** o usuário seleciona a opção `Sem sprint` no filtro de Sprint
- **THEN** apenas cards sem nenhum vínculo em `itemSprints` são exibidos

#### Scenario: Filtrar cards sem versão
- **WHEN** o usuário seleciona a opção `Sem versão` no filtro de Versão
- **THEN** apenas cards com `versionId` nulo são exibidos

#### Scenario: Filtrar cards não atribuídos
- **WHEN** o usuário seleciona a opção `Não atribuído` no filtro de Responsável
- **THEN** apenas cards com `assigneeId` nulo são exibidos

#### Scenario: Filtrar cards sem autor
- **WHEN** o usuário seleciona a opção `Sem autor` no filtro de Autor
- **THEN** apenas cards com `authorId` nulo são exibidos

#### Scenario: Filtrar cards sem centro de custo
- **WHEN** o usuário seleciona a opção `Sem centro de custo` no filtro de Centro de Custo
- **THEN** apenas cards com `costCenterId` nulo são exibidos

#### Scenario: Estado neutro difere do valor vazio
- **WHEN** o filtro do campo está no estado neutro (sem filtro)
- **THEN** cards com e sem valor são exibidos
- **AND** esse estado não é confundido com a opção de valor vazio

#### Scenario: Valor vazio combinado com outro filtro
- **WHEN** o filtro `Sem sprint` está ativo junto de outro filtro de conteúdo
- **THEN** os critérios são combinados com AND e apenas cards sem sprint que também satisfazem o outro filtro são exibidos

#### Scenario: Remover filtro de valor vazio
- **WHEN** o usuário volta o campo ao estado neutro
- **THEN** os cards com e sem valor voltam a ser exibidos conforme os demais filtros ativos

#### Scenario: Campos não anuláveis sem opção vazia
- **WHEN** o usuário abre os filtros de Prioridade, Status ou Tipo
- **THEN** não há opção de valor vazio, pois esses campos sempre possuem valor
