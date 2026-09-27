## MODIFIED Requirements

### Requirement: Servidor MCP nativo com ferramentas de board

O sistema SHALL disponibilizar um servidor MCP (Model Context Protocol) com ferramentas para agentes de IA operarem o board sem código adicional. O catálogo de definições, schemas, políticas e executores SHALL ser reutilizável pelo harness do Azy Agent sem duplicar regras de domínio. O catálogo SHALL derivar schema, obrigatoriedade, routing, limites e validação de uma definição única por ferramenta. As ferramentas de projeto SHALL aceitar e retornar os campos opcionais de planejamento `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope`. A ferramenta `list_tasks` SHALL usar uma projeção leve e paginação por padrão, com detalhes completos apenas quando solicitados explicitamente.

#### Scenario: Listar tasks disponíveis

- **WHEN** agente invoca ferramenta `list_tasks` com `{ projectId, sprintId?, type?, onlyLeaves? }`
- **THEN** servidor retorna lista de items filtrados; `type` aceita EPIC, STORY, TASK, BUG ou combinações separadas por vírgula; `onlyLeaves=true` (padrão) retorna apenas items sem filhos, e a resposta usa limite e projeção leve por padrão

#### Scenario: Navegar hierarquia antes de criar items

- **WHEN** agente precisa criar uma STORY ou TASK e não possui os IDs dos ancestrais
- **THEN** agente usa `list_tasks` com `type=EPIC` ou `type=STORY` e `onlyLeaves=false` para obter IDs sem precisar saber a hierarquia de memória

#### Scenario: Verificar sprint atual

- **WHEN** agente invoca ferramenta `get_current_sprint` com `{ projectId }`
- **THEN** servidor retorna dados da sprint ativa ou informa `status: NONE` com próximos passos para listar e ativar uma sprint

#### Scenario: Criar projeto com campos de planejamento via MCP

- **WHEN** agente invoca `create_project` com `{ name, startDate, plannedEndDate, plannedPoints, plannedHours, scope }`
- **THEN** servidor cria o projeto com os campos de planejamento informados e os retorna na resposta

#### Scenario: Atualizar campos de planejamento via MCP

- **WHEN** agente invoca `update_project` com `{ projectId, plannedPoints: 120, scope: "<p>Escopo revisado</p>" }`
- **THEN** servidor atualiza apenas os campos enviados e retorna o projeto atualizado

#### Scenario: Obter projeto com planejamento via MCP

- **WHEN** agente invoca `get_project` com `{ projectId }`
- **THEN** servidor retorna o projeto incluindo `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope` (null quando não preenchidos)

#### Scenario: Definição única sustenta a exposição

- **WHEN** o servidor monta a listagem de ferramentas para o cliente MCP
- **THEN** schema, obrigatoriedade e descrições vêm da mesma definição única por ferramenta usada pela validação e pelo harness, sem tabelas paralelas

### Requirement: Ferramenta MCP check_item

O sistema SHALL expor ferramenta `check_item` para marcar um item de checklist como concluído ou não-concluído. Além do caminho por `itemId` + `checklistId` + `checklistItemId`, SHALL aceitar resolução semântica por `itemId`, nome exato do checklist e texto/posição do passo. Resolução ambígua SHALL falhar de forma acionável.

#### Scenario: Agente marca passo por IDs

- **WHEN** agente invoca `check_item` com `{ projectId, itemId, checklistId, checklistItemId, checked: true }`
- **THEN** sistema atualiza `checked` e emite evento WebSocket `CHECKLIST_UPDATED`; humanos acompanhando o board veem o progresso atualizar em tempo real

#### Scenario: Agente marca passo por nome

- **WHEN** agente invoca `check_item` com `{ projectId, itemId, checklistName, text, checked: true }` e existe exatamente um checklist e item compatíveis
- **THEN** servidor resolve os IDs internamente, atualiza o passo e retorna o item atualizado

#### Scenario: Busca semântica ambígua

- **WHEN** o texto informado corresponde a mais de um passo do checklist
- **THEN** servidor não escolhe silenciosamente e retorna erro acionável com os candidatos e orientação para enviar IDs ou `position`

### Requirement: Suíte automatizada de regressão MCP

O sistema SHALL manter testes automatizados executáveis por `bun run test:mcp` para validar o comportamento das ferramentas MCP sem depender de servidor externo, banco ou credenciais reais. A suíte SHALL cobrir projeção/limite de `list_tasks`, resposta de mudanças aplicadas, recuperação acionável e operações semânticas/em lote de checklist.

#### Scenario: Fluxo completo de board via MCP

- **WHEN** a suíte de regressão MCP executa contra uma API fake em memória
- **THEN** ela cria um projeto de teste, consulta módulos e sprint, cria EPIC, STORY, TASK e subtarefa, reivindica e move task entre etapas, cria checklist, adiciona itens, marca progresso e conclui a task

#### Scenario: Proteção contra regressões de hierarquia

- **WHEN** a suíte tenta criar TASK filha direta de EPIC ou STORY filha de item não-EPIC
- **THEN** as ferramentas rejeitam a operação antes de criar item na API e retornam erro acionável

#### Scenario: Execução recorrente ao fim de implementação

- **WHEN** uma rodada de implementação termina
- **THEN** o comando `bun run test:mcp` pode ser executado para verificar que os fluxos principais do MCP continuam íntegros

#### Scenario: Orçamento de listagem

- **WHEN** a suíte chama `list_tasks` sem `includeDescriptions` nem `limit`
- **THEN** a resposta respeita o limite padrão e não inclui descrições completas

## ADDED Requirements

### Requirement: Resposta de mutação autoexplicativa

As ferramentas `update_item` e `update_items` SHALL separar identidade do item e mudança aplicada. `items[].changes` SHALL conter somente os valores efetivamente aplicados, `items[].identity` SHALL conter dados de identificação e `matchedCount`/`updatedCount` SHALL permanecer presentes. Quando houver valor comum, a resposta SHALL incluir resumo agregado em `applied`.

#### Scenario: Atualização filtrada retorna mudança aplicada

- **WHEN** agente atualiza o sprint de vários itens com `update_items`
- **THEN** resposta inclui `matchedCount`, `updatedCount`, `applied.sprint` e, por item, `changes.sprint` com o valor aplicado

#### Scenario: Identidade não aparece como mudança

- **WHEN** uma atualização retorna itens afetados
- **THEN** título, parentId, moduleId e outros dados de identidade aparecem em `identity`, não em `changes`, salvo quando forem o campo explicitamente alterado

### Requirement: Listagem leve e projetável

`list_tasks` SHALL aceitar `includeDescriptions`, `fields`, `limit` e `cursor`. O default de `includeDescriptions` SHALL ser `false`, o limite default SHALL ser 50 e o máximo SHALL ser 100. A resposta padrão SHALL achatar relações de sprint e tags disponíveis, e `fields` SHALL rejeitar nomes desconhecidos.

#### Scenario: Detalhes completos sob demanda

- **WHEN** agente invoca `list_tasks` com `includeDescriptions: true`
- **THEN** descrições completas são retornadas respeitando `limit` e `cursor`

#### Scenario: Projeção rápida

- **WHEN** agente invoca `list_tasks` com `fields: ["id", "title", "status", "sprintName"]`
- **THEN** resposta contém somente a projeção solicitada e campos estruturais mínimos necessários

### Requirement: Recuperação de chamada inválida

O servidor e a skill SHALL fornecer mensagens de validação com código, causa, campos rejeitados e snippet mínimo quando aplicável. Erro de JSON inválido na chamada SHALL orientar uma única repetição isolada antes de abortar, sem afirmar que a mutação foi executada.

#### Scenario: Payload inválido orienta correção

- **WHEN** agente invoca uma ferramenta com objeto inválido ou campo desconhecido
- **THEN** resposta identifica o caminho rejeitado e mostra a forma mínima aceita

#### Scenario: JSON inválido não confirma execução

- **WHEN** o cliente falha ao serializar os argumentos antes da chamada MCP
- **THEN** skill orienta retry isolado uma vez e, em nova falha, orienta reportar o erro sem repetir indefinidamente ou alegar sucesso
