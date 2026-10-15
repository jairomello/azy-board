# Spec Delta

## MODIFIED Requirements

### Requirement: Ferramenta de leitura das métricas oficiais

O catálogo compartilhado SHALL expor a ferramenta de leitura `get_dashboard_metrics` com o seletor obrigatório `metric` (`snapshot`, `burnup`, `aging`, `hours`, `sprint`, `tokens`), disponível tanto no MCP quanto no Azy Agent. A ferramenta SHALL ser somente-leitura, sem aprovação, e revalidar server-side a permissão de leitura do projeto (VIEWER+) e o isolamento por tenant/membership antes de devolver qualquer dado. O resultado SHALL ser um digest com métrica, `capturedAt`, filtros aplicados, critérios, avisos de cobertura e amostra limitada de itens de origem.

#### Scenario: Pergunta sobre WIP no dashboard

- **WHEN** o usuário pergunta “por que meu WIP está em 18?” na tela do Dashboard
- **THEN** o agente chama `get_dashboard_metrics` com `metric: snapshot` e responde com o WIP oficial do recorte, seus critérios e os itens que o compõem

#### Scenario: Sem acesso ao projeto

- **WHEN** o autor do pedido não é membro do projeto ou é de outro tenant
- **THEN** a ferramenta não devolve métricas e o servidor rejeita a leitura sem revelar dados

#### Scenario: Múltiplas métricas no mesmo passo

- **WHEN** o pedido exige WIP e horas registradas
- **THEN** o harness permite emitir as duas leituras independentes no mesmo passo, cada uma com seu `metric`

#### Scenario: Recortes e série de tokens

- **WHEN** o usuário pergunta quanto de IA o projeto, a sprint ou um módulo consumiu
- **THEN** o agente chama `get_dashboard_metrics` com `metric: tokens` e recebe os recortes e a série oficiais, com os filtros e a aplicabilidade declarados

### Requirement: Paridade de números e regras com o Dashboard

`get_dashboard_metrics` SHALL derivar seus valores das mesmas rotas/regras do Dashboard (Leaf Rule contando apenas `TASK`/`BUG` folha não arquivada, determinada antes dos filtros; estado atual para WIP/Bloqueados/Atrasados/Carga/Tokens; histórico por evento para Burnup/Aging/Tokens; logs manuais para Horas). O sistema MUST NOT recalcular métricas com regra própria que possa divergir da tela.

#### Scenario: Mesmo recorte, mesmo valor

- **WHEN** agente e Dashboard consultam o mesmo projeto com os mesmos filtros e período
- **THEN** o valor retornado pela ferramenta é igual ao exibido no Dashboard

#### Scenario: Pai oculto pelo filtro

- **WHEN** um filtro oculta os filhos de uma `TASK` pai
- **THEN** a pai não passa a ser contabilizada como folha, mantendo a paridade com o Dashboard

#### Scenario: Tokens com o mesmo valor

- **WHEN** agente e Dashboard consultam tokens do mesmo projeto com os mesmos filtros
- **THEN** recortes e série retornados pela ferramenta são iguais aos exibidos no quadro de tokens
