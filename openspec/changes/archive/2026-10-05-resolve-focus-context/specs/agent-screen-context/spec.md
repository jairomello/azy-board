## MODIFIED Requirements

### Requirement: Fotografia do contexto da tela

O frontend SHALL capturar e transportar, no envio de cada pedido ao Azy Agent, uma fotografia versionada do contexto de trabalho contendo: tela, projeto (id e nome), modo de visualização (Kanban ou árvore), aba de módulo ativa, grupos recolhidos, filtros ativos com semântica explícita de ausência de valor, o modo de escopo (`scope: 'ALL' | 'FILTERED'`) que determina se IDs viajam, o **estado de apresentação** necessário para explicar regras da visão (`showSubtasks`, `storyDisplay`, `moduleViewMode`, `hideEmptyEpics`, `hideEmptyStories`) e o **foco** — a pilha ordenada de modais, o item em primeiro plano, a aba/área ativa do item e o objeto interno selecionado. IDs de agrupadores e histórias virtuais NÃO SHALL ser enviados como IDs persistidos de cards. O transporte é opcional: clientes sem fotografia continuam funcionando, e tanto o estado de apresentação quanto o foco são opcionais — sua ausência degrada a explicação/resolução, sem erro.

#### Scenario: Sem filtro nenhum, a ação vale para todos sem enviar IDs

- **WHEN** usuário envia mensagem no board sem nenhum filtro aplicado
- **THEN** a fotografia declara `scope: 'ALL'` e NÃO envia a lista de IDs; o agente sabe que a ação é aplicável a todos os cards do projeto

#### Scenario: Envio com filtro declara o conjunto específico

- **WHEN** usuário envia mensagem no board Kanban com filtros ativos
- **THEN** a fotografia declara `scope: 'FILTERED'` e inclui os IDs reais apresentados (inclusive de grupos recolhidos e da aba de módulo ativa), `displayedCount` e `isComplete`

#### Scenario: Conjunto enorme acima do limite vira referência

- **WHEN** o conjunto capturado excede o limite definido
- **THEN** o snapshot é persistido no servidor e os args apenas o referenciam — sem truncamento silencioso

#### Scenario: Agrupadores e histórias virtuais não entram no conjunto

- **WHEN** o board apresenta histórias/épicos como agrupadores e histórias virtuais
- **THEN** a fotografia não os lista em `displayedItemIds`

#### Scenario: Ausência de valor é expressa por operador

- **WHEN** usuário aplica os filtros “sem sprint” e “sem versão”
- **THEN** a fotografia expressa a ausência por operador tipado, e não como ID, nome de entidade ou sentinela da interface

#### Scenario: Estado de apresentação viaja na fotografia

- **WHEN** o usuário está no board com regra de folha/subtarefas, exibição de histórias, modo de módulos e ocultação de grupos vazios definidos
- **THEN** a fotografia carrega o estado de apresentação correspondente para permitir explicar por que um card é escondido por regra da visão

#### Scenario: Fotografia sem estado de apresentação não falha

- **WHEN** a fotografia é capturada sem os campos de apresentação
- **THEN** o transporte continua válido e a explicação degrada para os motivos determináveis, sem erro

#### Scenario: Foco com subtarefa aberta sobre o pai

- **WHEN** o usuário abre uma subtarefa sobre a modal do pai e envia um pedido
- **THEN** a fotografia carrega a pilha de modais com o pai e a subtarefa, e `activeItemId` aponta para a subtarefa (o item em primeiro plano)

#### Scenario: Foco com aba ativa

- **WHEN** o usuário está na aba Checklists (ou Atividade/Links) da modal do item
- **THEN** a fotografia carrega a aba/área ativa e, quando houver seleção explícita, o objeto interno selecionado

#### Scenario: Fotografia sem foco não falha

- **WHEN** a fotografia é capturada sem os campos de foco
- **THEN** o transporte continua válido e a resolução degrada para o item da mensagem, sem erro
