## Purpose

Definir os modos de apresentação e a conversão segura entre boards simples e hierárquicos.

## Requirements

### Requirement: Modos de board do projeto
O sistema SHALL suportar os modos `HIERARCHICAL` e `SIMPLE` por projeto. Projetos existentes e projetos criados sem indicação explícita SHALL usar `HIERARCHICAL`.

#### Scenario: Projeto existente mantém o modo atual
- **WHEN** uma migração adiciona o campo de modo a projetos existentes
- **THEN** todos os projetos recebem `HIERARCHICAL` sem alteração dos itens ou da apresentação atual

#### Scenario: Projeto simples não usa agrupamento hierárquico
- **WHEN** usuário abre um projeto com `boardMode = SIMPLE`
- **THEN** o board exibe as colunas em fluxo único, uma STORY fixa e cards TASK/BUG, sem lanes de módulos ou épicos

#### Scenario: Projeto hierárquico conserva o comportamento atual
- **WHEN** usuário abre um projeto com `boardMode = HIERARCHICAL`
- **THEN** o board mantém o agrupamento por módulos, EPICs e STORYs e as regras hierárquicas existentes

### Requirement: História fixa do modo simples
Todo projeto no modo `SIMPLE` SHALL possuir exatamente uma STORY fixa identificada pelo projeto. TASKs e BUGs SHALL ser filhos diretos dessa STORY para fins de exibição no board simples.

#### Scenario: História fixa é criada
- **WHEN** projeto é criado diretamente no modo `SIMPLE`
- **THEN** sistema cria uma única STORY fixa, registra sua referência e provisiona as colunas padrão

#### Scenario: Não há segunda história fixa
- **WHEN** uma operação de leitura ou conversão é executada em projeto simples
- **THEN** sistema mantém uma única referência de STORY fixa e não cria duplicatas

### Requirement: Conversão segura entre modos
A alteração do modo SHALL ser permitida a ADMIN e ocorrer em transação atômica com filtros de `tenant_id` e `project_id`. A conversão SHALL preservar TASK/BUG, IDs, conteúdo, relações de tags, sprints, anexos, checklists, logs e colunas.

#### Scenario: Converter hierárquico para simples
- **WHEN** ADMIN altera `HIERARCHICAL` para `SIMPLE` e confirma
- **THEN** sistema cria ou identifica a STORY fixa, move TASKs/BUGs para ela, recalcula breadcrumbs, remove módulos e EPICs e não exclui cards

#### Scenario: Converter simples para hierárquico
- **WHEN** ADMIN altera `SIMPLE` para `HIERARCHICAL`
- **THEN** sistema provisiona módulo `Geral` e EPIC `Fluxo contínuo` quando necessário, vincula a STORY fixa ao EPIC e preserva os cards

#### Scenario: Falha durante conversão
- **WHEN** qualquer atualização ou exclusão necessária falha
- **THEN** sistema faz rollback, mantém o modo anterior e retorna erro

#### Scenario: Usuário sem permissão tenta converter
- **WHEN** MEMBER ou VIEWER tenta alterar o modo
- **THEN** sistema retorna HTTP 403 e não altera estrutura nem cards

#### Scenario: Projeto de outro tenant é informado
- **WHEN** usuário tenta alterar modo de projeto fora do tenant ou sem membership
- **THEN** sistema retorna HTTP 404 e não altera dados

### Requirement: Confirmação da conversão destrutiva
O sistema SHALL solicitar confirmação antes de converter projeto hierárquico para simples e informar que módulos e épicos serão removidos, enquanto TASKs e BUGs serão preservados e movidos para uma única história.

#### Scenario: ADMIN cancela a conversão
- **WHEN** ADMIN cancela ou fecha o diálogo
- **THEN** nenhuma chamada é enviada e o modo permanece inalterado

#### Scenario: ADMIN confirma a conversão
- **WHEN** ADMIN confirma o diálogo
- **THEN** sistema inicia a operação transacional e atualiza a interface somente após sucesso

---

### Requirement: Apresentação do board com níveis ocultados

Em projetos `HIERARCHICAL` com a opção de ocultar módulos e/ou épicos ligada, o
board Kanban SHALL pular o nível correspondente: sem módulos, os épicos aparecem
no nível do projeto; sem épicos, as histórias aparecem sob o módulo ou no nível
do projeto; sem ambos, histórias e cards aparecem diretamente. A ordem e o
arraste dos cards SHALL ser preservados.

#### Scenario: Board sem módulos

- **WHEN** o projeto tem módulos ocultos e épicos visíveis
- **THEN** o board não renderiza swimlanes de módulo e exibe as swimlanes de épico diretamente

#### Scenario: Board sem épicos

- **WHEN** o projeto tem épicos ocultos e módulos visíveis
- **THEN** o board não renderiza swimlanes de épico e exibe as histórias/cards sob cada módulo

#### Scenario: Board sem módulos nem épicos

- **WHEN** o projeto tem as duas opções ligadas
- **THEN** o board exibe histórias e cards diretamente, sem módulos nem épicos

#### Scenario: Movimentação preservada

- **WHEN** níveis estão ocultos
- **THEN** TASKs, BUGs e histórias folha continuam arrastáveis entre colunas conforme as regras vigentes
