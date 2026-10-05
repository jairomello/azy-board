## MODIFIED Requirements

### Requirement: Fotografia do contexto da tela

O frontend SHALL capturar e transportar, no envio de cada pedido ao Azy Agent, uma fotografia versionada do contexto de trabalho contendo: tela, projeto (id e nome), modo de visualização (Kanban ou árvore), aba de módulo ativa, grupos recolhidos, filtros ativos com semântica explícita de ausência de valor, o modo de escopo (`scope: 'ALL' | 'FILTERED'`) que determina se IDs viajam e o **estado de apresentação** necessário para explicar regras da visão (`showSubtasks`, `storyDisplay`, `moduleViewMode`, `hideEmptyEpics`, `hideEmptyStories`). IDs de agrupadores e histórias virtuais NÃO SHALL ser enviados como IDs persistidos de cards. O transporte é opcional: clientes sem fotografia continuam funcionando, e o estado de apresentação é opcional — sua ausência degrada a explicação de regras de visão, sem erro.

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
