## MODIFIED Requirements

### Requirement: Exibir filtros ativos
O Board SHALL exibir os filtros ativos que alteram a visualização de forma legível e removível individualmente. No layout de cabeçalho completo, SHALL exibir uma linha de tags compactas entre a barra de controles e o conteúdo do Board. No modo de cabeçalho compacto, SHALL resumir os filtros ativos em um controle na barra de controles que, ao ser acionado, apresenta a lista completa com a mesma remoção individual.

#### Scenario: Nenhum filtro ativo
- **WHEN** todos os filtros estão no estado padrão
- **THEN** nenhuma linha ou resumo de filtros ativos é renderizado e o espaçamento/visual do Board permanece como antes

#### Scenario: Filtros ativos no layout completo
- **WHEN** um ou mais filtros de conteúdo estão aplicados com o cabeçalho completo
- **THEN** a linha exibe uma tag para cada filtro ativo com nome legível e indicação do valor vigente

#### Scenario: Filtros ativos no cabeçalho compacto
- **WHEN** há filtros ativos e o cabeçalho compacto está ligado
- **THEN** a barra mostra um resumo com a quantidade de filtros ativos e a lista completa fica acessível sob demanda

### Requirement: Remover filtro individual
Cada tag SHALL ter um botão acessível para remover somente o filtro representado, sem limpar filtros ou opções restantes, tanto no layout completo quanto na lista acessada pelo resumo do cabeçalho compacto.

#### Scenario: Remover uma tag
- **WHEN** usuário ativa o botão `x` de uma tag
- **THEN** somente o filtro daquela tag é limpo, o Board é recalculado e as demais tags continuam visíveis

#### Scenario: Remover último filtro
- **WHEN** usuário remove a última tag ativa
- **THEN** a linha ou o resumo desaparece e o Board retorna ao estado sem filtros

#### Scenario: Remover pelo resumo compacto
- **WHEN** usuário abre o resumo de filtros no cabeçalho compacto e remove uma tag
- **THEN** somente aquele filtro é limpo e o resumo passa a refletir a nova contagem

### Requirement: Catálogos, persistência e idiomas
As tags SHALL usar nomes dos catálogos disponíveis, refletir a persistência por projeto e possuir textos traduzidos em PT-BR, EN e ES.

#### Scenario: Filtro de catálogo
- **WHEN** usuário filtra por módulo, sprint, versão, squad, responsável, autor, tag ou centro de custo
- **THEN** a tag mostra o nome legível do catálogo e a remoção limpa apenas esse valor

#### Scenario: Remoção persistida
- **WHEN** usuário remove uma tag e sai do projeto
- **THEN** ao retornar o filtro removido continua limpo e os demais filtros são restaurados

#### Scenario: Navegação por teclado
- **WHEN** usuário navega pela linha ou pelo resumo usando teclado
- **THEN** cada botão `x` e o controle de resumo possuem foco visível e rótulo acessível com filtro e valor que serão removidos

### Requirement: Chip para filtro por valor vazio
Os filtros de valor vazio aplicados (Sprint, Versão, Responsável, Autor ou Centro de Custo) SHALL ser exibidos como chip com rótulo legível do estado vazio (`Sem sprint`, `Sem versão`, `Não atribuído`, `Sem autor`, `Sem centro de custo`), tanto na linha quanto no resumo do cabeçalho compacto. O estado neutro (sem filtro) SHALL NOT gerar chip.

#### Scenario: Chip de sprint vazia
- **WHEN** o filtro de Sprint está no estado de valor vazio
- **THEN** é exibido um chip com o rótulo `Sem sprint` e botão acessível de remoção

#### Scenario: Remover chip de valor vazio
- **WHEN** o usuário remove o chip de valor vazio de um campo
- **THEN** somente esse campo volta ao estado neutro, o Board é recalculado e os demais chips permanecem

#### Scenario: Estado neutro sem chip
- **WHEN** o filtro de um campo está no estado neutro
- **THEN** nenhum chip é exibido para esse campo

#### Scenario: Múltiplos filtros de valor vazio
- **WHEN** mais de um campo está no estado de valor vazio
- **THEN** é exibido um chip para cada campo, cada um removível independentemente
