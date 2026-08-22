## ADDED Requirements

### Requirement: Modos de board do projeto

O sistema SHALL suportar os modos `HIERARCHICAL` e `SIMPLE` por projeto. Projetos existentes e projetos criados sem indicação explícita SHALL usar `HIERARCHICAL`.

#### Scenario: Projeto existente mantém o modo atual
- **WHEN** uma migração adiciona o campo de modo a projetos existentes
- **THEN** todos os projetos recebem `HIERARCHICAL` sem alteração dos itens ou da apresentação atual

#### Scenario: Projeto simples não usa agrupamento de módulos e épicos
- **WHEN** usuário abre um projeto com `boardMode = SIMPLE`
- **THEN** o board exibe as colunas do projeto em um fluxo único, uma STORY fixa e os cards TASK/BUG dessa história, sem lanes de módulos ou épicos

#### Scenario: Projeto hierárquico conserva o comportamento atual
- **WHEN** usuário abre um projeto com `boardMode = HIERARCHICAL`
- **THEN** o board mantém o agrupamento por módulos, EPICs e STORYs e as regras hierárquicas existentes

### Requirement: História fixa do modo simples

Todo projeto no modo `SIMPLE` SHALL possuir exatamente uma STORY fixa identificada pelo projeto. Os TASKs e BUGs do projeto SHALL ser filhos diretos dessa STORY para fins de exibição no board simples.

#### Scenario: História fixa é criada
- **WHEN** projeto é criado diretamente no modo `SIMPLE`
- **THEN** sistema cria uma única STORY fixa, registra sua referência no projeto e provisiona as colunas padrão do Kanban

#### Scenario: Cards simples aparecem na história fixa
- **WHEN** usuário acessa o board de um projeto simples
- **THEN** todos os TASKs e BUGs do projeto aparecem nas colunas correspondentes sob a única STORY fixa

#### Scenario: Não há segunda história fixa
- **WHEN** uma operação de leitura ou conversão é executada em projeto simples
- **THEN** sistema mantém uma única referência de STORY fixa e não cria histórias fixas duplicadas

### Requirement: Conversão segura entre modos

A alteração do modo SHALL ser permitida a ADMIN e SHALL ocorrer em uma transação atômica com filtros de `tenant_id` e `project_id`. A conversão SHALL preservar os registros TASK/BUG, seus IDs, conteúdo, relações de tags, sprints, anexos, checklists, logs e colunas.

#### Scenario: Converter hierárquico para simples
- **WHEN** ADMIN altera um projeto de `HIERARCHICAL` para `SIMPLE` e confirma a operação
- **THEN** sistema cria ou identifica a STORY fixa, move todos os TASKs/BUGs para ela, recalcula seus breadcrumbs, remove módulos e EPICs e conclui sem excluir nenhum TASK/BUG

#### Scenario: Converter simples para hierárquico
- **WHEN** ADMIN altera um projeto de `SIMPLE` para `HIERARCHICAL`
- **THEN** sistema provisiona módulo `Geral` e EPIC `Fluxo contínuo` quando necessário, vincula a STORY fixa ao EPIC e preserva os cards existentes

#### Scenario: Falha durante conversão
- **WHEN** qualquer atualização ou exclusão necessária à conversão falha
- **THEN** sistema faz rollback de todas as alterações, mantém o modo anterior e retorna erro ao cliente

#### Scenario: Usuário sem permissão tenta converter
- **WHEN** MEMBER ou VIEWER tenta alterar o modo do projeto
- **THEN** sistema retorna HTTP 403 e não altera estrutura nem cards

#### Scenario: Projeto de outro tenant é informado
- **WHEN** usuário tenta alterar o modo usando ID de projeto fora do tenant ou sem membership
- **THEN** sistema retorna HTTP 404 e não altera dados

### Requirement: Confirmação da conversão destrutiva

O sistema SHALL solicitar confirmação antes de converter um projeto hierárquico para simples e SHALL informar que módulos e épicos serão removidos, enquanto TASKs e BUGs serão preservados e movidos para uma única história.

#### Scenario: ADMIN cancela a conversão
- **WHEN** ADMIN cancela ou fecha o diálogo de conversão
- **THEN** nenhuma chamada de alteração é enviada e o modo do projeto permanece inalterado

#### Scenario: ADMIN confirma a conversão
- **WHEN** ADMIN confirma o diálogo de conversão
- **THEN** sistema inicia a operação transacional e atualiza a interface somente após sucesso
