## ADDED Requirements

### Requirement: Ferramenta de leitura das métricas oficiais

O catálogo compartilhado SHALL expor a ferramenta de leitura `get_dashboard_metrics` com o seletor obrigatório `metric` (`snapshot`, `burnup`, `aging`, `hours`, `sprint`), disponível tanto no MCP quanto no Azy Agent. A ferramenta SHALL ser somente-leitura, sem aprovação, e revalidar server-side a permissão de leitura do projeto (VIEWER+) e o isolamento por tenant/membership antes de devolver qualquer dado. O resultado SHALL ser um digest com métrica, `capturedAt`, filtros aplicados, critérios, avisos de cobertura e amostra limitada de itens de origem.

#### Scenario: Pergunta sobre WIP no dashboard

- **WHEN** o usuário pergunta “por que meu WIP está em 18?” na tela do Dashboard
- **THEN** o agente chama `get_dashboard_metrics` com `metric: snapshot` e responde com o WIP oficial do recorte, seus critérios e os itens que o compõem

#### Scenario: Sem acesso ao projeto

- **WHEN** o autor do pedido não é membro do projeto ou é de outro tenant
- **THEN** a ferramenta não devolve métricas e o servidor rejeita a leitura sem revelar dados

#### Scenario: Múltiplas métricas no mesmo passo

- **WHEN** o pedido exige WIP e horas registradas
- **THEN** o harness permite emitir as duas leituras independentes no mesmo passo, cada uma com seu `metric`

### Requirement: Paridade de números e regras com o Dashboard

`get_dashboard_metrics` SHALL derivar seus valores das mesmas rotas/regras do Dashboard (Leaf Rule contando apenas `TASK`/`BUG` folha não arquivada, determinada antes dos filtros; estado atual para WIP/Bloqueados/Atrasados/Carga; histórico por evento para Burnup/Aging; logs manuais para Horas). O sistema MUST NOT recalcular métricas com regra própria que possa divergir da tela.

#### Scenario: Mesmo recorte, mesmo valor

- **WHEN** agente e Dashboard consultam o mesmo projeto com os mesmos filtros e período
- **THEN** o valor retornado pela ferramenta é igual ao exibido no Dashboard

#### Scenario: Pai oculto pelo filtro

- **WHEN** um filtro oculta os filhos de uma `TASK` pai
- **THEN** a pai não passa a ser contabilizada como folha, mantendo a paridade com o Dashboard

### Requirement: Filtros e período equivalentes ao Dashboard

A ferramenta SHALL aceitar os filtros período (`from`/`to`), módulo, sprint, versão, squad, responsável e tipo, com a mesma aplicabilidade do Dashboard: período aplica-se a Burnup e Horas; os demais usam o estado atual quando aplicável. Filtros inaplicáveis a um recorte SHALL ser declarados como inaplicáveis e MUST NOT alterar silenciosamente o resultado. Quando o pedido não informar filtros e a tela ativa for o Dashboard, a ferramenta SHALL usar os filtros e o período da fotografia da tela; filtro explícito no pedido prevalece sobre a fotografia.

#### Scenario: Período não se aplica ao WIP

- **WHEN** há período selecionado e a consulta é de WIP atual
- **THEN** a resposta declara o período como inaplicável ao WIP e mantém o estado atual

#### Scenario: Filtros herdados da tela do Dashboard

- **WHEN** o usuário pede “quais estão bloqueados há mais tempo?” com filtros aplicados no Dashboard
- **THEN** a ferramenta usa os mesmos filtros e o mesmo período da fotografia da tela

#### Scenario: Filtro explícito prevalece

- **WHEN** o pedido informa um filtro diferente do estado da tela
- **THEN** a ferramenta usa o filtro explícito do pedido

### Requirement: Critérios e itens de origem

Cada resposta SHALL acompanhar os critérios do indicador (regra de folha, cobertura de pontos, autoria do log de horas) e uma amostra limitada dos itens que o compõem, suficiente para explicação e drill-down no board. Amostras truncadas SHALL declarar `truncated` e a contagem total, sem truncamento silencioso.

#### Scenario: Explicar a composição do indicador

- **WHEN** o agente responde sobre Bloqueados
- **THEN** a resposta inclui os critérios aplicados e os itens bloqueados com motivo, responsável e idade mínima conhecida quando houver

#### Scenario: Amostra limitada declarada

- **WHEN** a quantidade de itens de origem excede o limite de amostra
- **THEN** a resposta informa `truncated` e a contagem completa, sem descartar itens em silêncio

### Requirement: Cobertura parcial e populações sobrepostas

A resposta SHALL preservar os avisos de cobertura parcial das rotas (`coverage.partial`, `partial`, `coverageStartedAt`, `minimumKnown`) e SHALL rotular populações sobrepostas como não aditivas: WIP inclui Bloqueados, `blockedSubset ≤ wipTotal` e Atrasados sobrepõem WIP. O sistema MUST NOT apresentar essas populações como conjuntos disjuntos somáveis.

#### Scenario: Cobertura parcial do burnup

- **WHEN** o burnup inicia antes de `coverageStartedAt`
- **THEN** a resposta indica cobertura parcial e não fabrica o valor anterior à cobertura

#### Scenario: Bloqueados é subconjunto do WIP

- **WHEN** um membro possui uma única folha `BLOCKED`
- **THEN** a resposta apresenta WIP 1 e Bloqueados 1 como sobrepostos, sem somá-los como dois itens

#### Scenario: Aging legado

- **WHEN** o item já estava ativo no baseline sem início conhecido
- **THEN** a resposta apresenta a idade como mínima conhecida, sem afirmar a data real de início

### Requirement: Somente-leitura e sem mutação

A ferramenta SHALL classificar-se como operação de leitura (`risk: READ`), sem etapa de aprovação, e MUST NOT alterar dados, visões ou filtros do usuário. Ela NÃO SHALL ser usada para substituir mutações nem para inferir permissões a partir de IDs recebidos.

#### Scenario: Nenhuma aprovação solicitada

- **WHEN** o agente consulta qualquer métrica
- **THEN** a execução ocorre como leitura, sem gerar pedido de aprovação

#### Scenario: Consulta não altera a tela

- **WHEN** a ferramenta é executada a partir de uma pergunta
- **THEN** filtros e visualização do usuário permanecem inalterados
