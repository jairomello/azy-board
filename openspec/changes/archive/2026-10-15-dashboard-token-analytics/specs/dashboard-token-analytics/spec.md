# Spec Delta

## Purpose

Expõe o consumo de tokens de IA por card como informação de planejamento no Dashboard do
projeto: recortes de estado atual por dimensão e série diária no tempo.

## ADDED Requirements

### Requirement: Recortes de estado atual de tokens

O Dashboard SHALL apresentar recortes de tokens sobre folhas `TASK`/`BUG` não
arquivadas, com o total derivado da soma de tokens de entrada e de saída. Os recortes
SHALL incluir a quebra por status, a quebra por tipo e o agrupamento por módulo, sprint,
versão, squad e responsável, sempre sobre a população completa e com ordenação
determinística.

#### Scenario: Recorte por status

- **WHEN** o quadro de tokens é exibido em um projeto com folhas em `DONE`, `IN_PROGRESS`, `BLOCKED` e `NOT_STARTED` com tokens registrados
- **THEN** cada status apresenta seu próprio total de tokens, e a soma dos status corresponde ao total da população

#### Scenario: Folha com apenas um lado informado

- **WHEN** uma folha tem somente `tokensOutput` e nenhum `tokensInput`
- **THEN** o recorte soma apenas o valor informado, sem inventar valor para o lado ausente

#### Scenario: Recorte por dimensão

- **WHEN** o usuário consulta o agrupamento por módulo, sprint, versão, squad ou responsável
- **THEN** cada agrupamento apresenta o total de tokens dos itens elegíveis que pertencem a ele, sem contar um item duas vezes no mesmo agrupamento

#### Scenario: Pai oculto pelo filtro

- **WHEN** um filtro oculta os filhos de uma `TASK` pai
- **THEN** a `TASK` pai não passa a ser contabilizada como folha no recorte de tokens

### Requirement: Série diária de tokens no tempo

O quadro SHALL apresentar a série de estado ao fim de cada dia UTC, com os tokens
registrados no escopo e os tokens de itens concluídos (`DONE`). A série SHALL começar na
data de início da cobertura de tokens e respeitar o período solicitado.

#### Scenario: Série com dias sem evento

- **WHEN** um dia do intervalo não possui alteração de tokens
- **THEN** a série mantém o valor do dia anterior, sem criar lacuna

#### Scenario: Conclusão de item com tokens

- **WHEN** uma folha com tokens registrados passa a `DONE`
- **THEN** os tokens do item passam a contar na linha de concluídos a partir da data da conclusão

#### Scenario: Remoção e redução de tokens

- **WHEN** os tokens de um item são reduzidos ou limpos
- **THEN** a série reflete a redução na data da alteração, sem manter o valor anterior como consumo permanente

#### Scenario: Período anterior à cobertura

- **WHEN** o intervalo solicitado começa antes da data de início da cobertura de tokens
- **THEN** a série inicia na cobertura disponível e a resposta indica cobertura parcial

### Requirement: Ausência de consumo tratada explicitamente

Quando nenhuma folha tiver tokens registrados, o quadro SHALL NOT apresentar zero como
resultado: exibe uma orientação acionável de que ainda não há consumo de tokens
registrado. O quadro SHALL voltar a exibir os recortes quando existir ao menos um valor
registrado.

#### Scenario: Projeto sem tokens registrados

- **WHEN** nenhuma folha da população possui tokens de entrada ou de saída
- **THEN** o quadro mostra a orientação de registro e não exibe totais ou série zerados como se fossem resultado

#### Scenario: Cobertura de tokens posterior ao projeto

- **WHEN** a cobertura de tokens começa depois do início do projeto
- **THEN** o quadro declara a data de início da cobertura e não fabrica consumo anterior a ela

### Requirement: Filtros aplicáveis declarados

O recorte SHALL respeitar os filtros de módulo, sprint, versão, squad, responsável e
tipo. A série SHALL respeitar módulo, sprint, versão e tipo, e SHALL declarar squad e
responsável como inaplicáveis, seguindo a mesma aplicabilidade do Dashboard. O período
SHALL aplicar-se à série e SHALL ser declarado inaplicável aos recortes de estado atual.
Cada resposta SHALL informar quais filtros foram aplicados e quais são inaplicáveis.

#### Scenario: Período inaplicável ao estado atual

- **WHEN** o usuário informa um período e consulta os recortes de estado atual
- **THEN** os recortes permanecem no estado atual e a resposta declara o período como inaplicável a eles

#### Scenario: Filtro de dimensão recalculando tudo

- **WHEN** o usuário aplica um filtro de módulo, sprint, versão, squad, responsável ou tipo
- **THEN** o recorte e a série usam a mesma população filtrada do restante do Dashboard

#### Scenario: Squad e responsável fora da série

- **WHEN** o usuário aplica filtro de squad ou responsável e consulta a série de tokens
- **THEN** a resposta declara esses filtros como inaplicáveis à série, que usa a projeção por dimensão (módulo/versão/sprint/tipo), e o recorte continua respondendo ao filtro

### Requirement: Limite de resposta e paginação de detalhe

Os totais de tokens SHALL ser calculados sobre a população completa. As listas de detalhe
que compõem os recortes SHALL respeitar paginação por cursor opaco vinculado ao
escopo/filtros, com padrão de 50 e máximo de 100 registros, ordenação determinística com
desempate por ID, e SHALL declarar truncamento e continuidade sem simular completude. A
resposta comum SHALL limitar o JSON a 256 KiB, sem truncar silenciosamente a série ou os
totais.

#### Scenario: Detalhe truncado não altera totais

- **WHEN** um recorte possui mais detalhes que o limite da página
- **THEN** o total de tokens permanece o da população completa e a resposta indica truncamento e o cursor de continuação

#### Scenario: Cursor de outro escopo

- **WHEN** uma página é solicitada com cursor de outro tenant, projeto, filtro ou período
- **THEN** a requisição é rejeitada por validação sem retornar dados de outro escopo

### Requirement: Leitura autorizada e isolada por tenant

O quadro e a rota de tokens SHALL exigir permissão de leitura do projeto (VIEWER ou
superior) e SHALL filtrar toda leitura por tenant e projeto. Consultas de outro tenant ou
de projeto sem membership SHALL falhar sem revelar dados.

#### Scenario: Leitor autorizado

- **WHEN** um usuário com papel VIEWER, MEMBER ou ADMIN consulta os tokens de um projeto do qual participa
- **THEN** a resposta contém apenas os dados desse tenant e projeto

#### Scenario: Acesso fora do escopo

- **WHEN** um usuário consulta tokens de outro tenant ou de um projeto sem membership
- **THEN** a resposta é a mesma negação de recurso usada pelas rotas protegidas, sem dados de tokens

### Requirement: Apresentação acessível do quadro

O quadro de tokens SHALL apresentar métrica principal com rótulo e unidade, descrição
textual equivalente aos gráficos, legenda sem repetição de unidade, informação não
dependente exclusivamente de cor e estado vazio compacto sem área de gráfico reservada.

#### Scenario: Quadro sem dados na população filtrada

- **WHEN** o filtro aplicado não retorna folhas com tokens
- **THEN** o quadro exibe mensagem vazia compacta, sem reservar a altura de um gráfico

#### Scenario: Alternativa textual da série

- **WHEN** o usuário consulta a série de tokens com tecnologia assistiva
- **THEN** título, período, cobertura e uma leitura textual/tabular da série estão disponíveis
