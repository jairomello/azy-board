## MODIFIED Requirements

### Requirement: Progresso geral na listagem de projetos
A listagem de projetos SHALL expor e exibir o progresso geral de cada projeto. Com `includeProgress=true`, `GET /projects` SHALL incluir por projeto um resumo `progress` com `advance` (0–100), `done` e `total`. O `advance` SHALL ser o avanço no fluxo — média do avanço das folhas pela regra por status, o mesmo indicador do Dashboard, da árvore e do Board — e não a razão simples `DONE/total`. `done` e `total` SHALL contar as folhas de progresso (`TASK`, `BUG`, `STORY` ou `EPIC` sem filhos) não arquivadas, excluindo `CANCELLED`, dependências `EXTERNAL` e a STORY fixa do modo `SIMPLE`. Sem o parâmetro, a resposta SHALL permanecer sem o campo e sem custo de agregação. O card de projeto SHALL exibir barra de progresso, percentual e a contagem `x/y entregas` com rótulo acessível.

#### Scenario: Listagem com progresso
- **WHEN** o cliente solicita `GET /projects?includeProgress=true`
- **THEN** cada projeto retornado inclui `progress.advance`, `progress.done` e `progress.total` calculados no escopo do projeto

#### Scenario: Listagem sem progresso
- **WHEN** o cliente solicita `GET /projects` sem `includeProgress`
- **THEN** a resposta não inclui o campo `progress` e não executa a agregação

#### Scenario: Percentual reflete o avanço no fluxo
- **WHEN** um projeto tem folhas em colunas de pesos diferentes
- **THEN** o percentual exibido é a média do avanço dessas folhas pela regra por status, igual ao indicador do Dashboard

#### Scenario: Contagem de entregas
- **WHEN** um projeto tem folhas `TASK`/`BUG` concluídas e em andamento
- **THEN** o card mostra `done/total entregas` com o total de folhas do escopo de progresso

#### Scenario: Projeto sem folhas
- **WHEN** o projeto não possui folhas de progresso no escopo
- **THEN** o card mostra 0% e `0/0 entregas`, sem divisão inválida nem estado de erro

#### Scenario: Projeto arquivado
- **WHEN** a listagem está no recorte de projetos arquivados
- **THEN** o comportamento de progresso permanece o mesmo e nenhum projeto ativo aparece

#### Scenario: Falha na agregação
- **WHEN** o resumo de progresso não pode ser calculado
- **THEN** o restante da listagem continua disponível e o card sinaliza o progresso como indisponível, sem inventar percentual

#### Scenario: Acessibilidade do card
- **WHEN** o card de projeto é lido por tecnologia assistiva
- **THEN** a barra expõe valor, percentual e contagem de entregas em rótulo textual

#### Scenario: Status e coluna desencontrados

- **WHEN** um projeto tem uma folha `DONE` e uma `IN_HOMOLOGATION` paradas no Backlog, uma não iniciada e uma cancelada
- **THEN** a listagem apresenta avanço de 63% e `1/3 entregas`, igual ao Dashboard e à árvore
