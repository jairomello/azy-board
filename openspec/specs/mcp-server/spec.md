## Purpose

Definir o servidor MCP e o catálogo de ferramentas que agentes de IA usam para operar o board, com transporte e autenticação.
## Requirements
### Requirement: Servidor MCP nativo com ferramentas de board
O sistema SHALL disponibilizar um servidor MCP (Model Context Protocol) com ferramentas para agentes de IA operarem o board sem código adicional. O catálogo de definições, schemas, políticas e executores SHALL ser reutilizável pelo harness do Azy Agent sem duplicar regras de domínio. O catálogo SHALL derivar schema, obrigatoriedade, routing, limites e validação de uma definição única por ferramenta. As ferramentas de projeto SHALL aceitar e retornar os campos opcionais de planejamento `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope`. A ferramenta `list_tasks` SHALL usar uma projeção leve e paginação por padrão, com detalhes completos apenas quando solicitados explicitamente.

#### Scenario: Listar tasks disponíveis
- **WHEN** agente invoca ferramenta `list_tasks` com `{ projectId, sprintId?, type?, onlyLeaves? }`
- **THEN** servidor retorna lista de items filtrados; `type` aceita EPIC, STORY, TASK, BUG ou combinações separadas por vírgula; `onlyLeaves=true` (padrão) retorna apenas items sem filhos
- **THEN** servidor retorna lista de items filtrados; `type` aceita EPIC, STORY, TASK, BUG ou combinações separadas por vírgula; `onlyLeaves=true` (padrão) retorna apenas items sem filhos, e a resposta usa limite e projeção leve por padrão

#### Scenario: Navegar hierarquia antes de criar items
- **WHEN** agente precisa criar uma STORY ou TASK e não possui os IDs dos ancestrais
- **THEN** agente usa `list_tasks` com `type=EPIC` ou `type=STORY` e `onlyLeaves=false` para obter IDs sem precisar saber a hierarquia de memória

#### Scenario: Verificar sprint atual
- **WHEN** agente invoca ferramenta `get_current_sprint` com `{ projectId }`
- **THEN** servidor retorna dados da sprint ativa ou informa que não há sprint ativa
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

### Requirement: Harness reutiliza catálogo
O sistema SHALL permitir que o harness interno do Azy Agent reutilize as definições, schemas, políticas e executores do catálogo MCP sem duplicar regras de domínio.

#### Scenario: Harness reutiliza catálogo
- **WHEN** o Azy Agent interno prepara tools para uma run
- **THEN** utiliza as mesmas definições, schemas, políticas e executores do catálogo MCP, aplicando o contexto do usuário humano e sem iniciar uma chamada MCP com credencial compartilhada

---

### Requirement: Ferramenta claim_task no MCP
O sistema SHALL expor ferramenta `claim_task` que atribui uma task ao agente e a move para status IN_PROGRESS.

#### Scenario: Claim bem-sucedido
- **WHEN** agente invoca `claim_task` com `{ projectId, taskId }`
- **THEN** task é atribuída ao agente (vinculado ao Owner humano da API Key), status muda para IN_PROGRESS

#### Scenario: Task já reclamada
- **WHEN** agente tenta claim de task já atribuída
- **THEN** servidor retorna erro descritivo indicando quem está com a task

---

### Requirement: Ferramenta list_modules no MCP
O sistema SHALL expor ferramenta `list_modules` que lista os módulos de um projeto, fornecendo `id` e `name` de cada módulo.

#### Scenario: Agente obtém moduleId antes de criar EPIC
- **WHEN** agente invoca `list_modules` com `{ projectId }`
- **THEN** servidor retorna array `[{ id, name, position }]` com todos os módulos do projeto em ordem

---

### Requirement: Ferramenta move_task no MCP
O sistema SHALL expor ferramenta `move_task` para mover cards entre colunas.

#### Scenario: Mover card para coluna destino
- **WHEN** agente invoca `move_task` com `{ projectId, taskId, columnName }` usando nome da coluna (não ID)
- **THEN** servidor resolve o ID da coluna pelo nome e move o card, atualizando status base automaticamente

#### Scenario: Coluna não encontrada
- **WHEN** agente invoca `move_task` com nome de coluna inexistente
- **THEN** servidor retorna erro listando os nomes exatos das colunas disponíveis no projeto

---

### Requirement: Ferramenta complete_task no MCP
O sistema SHALL expor ferramenta `complete_task` que marca uma task como DONE e a move para a coluna de conclusão.

#### Scenario: Concluir task
- **WHEN** agente invoca `complete_task` com `{ projectId, taskId }`
- **THEN** task recebe status DONE e é movida para a coluna mapeada como DONE no projeto

---

### Requirement: Ferramenta create_task no MCP
O sistema SHALL expor ferramenta `create_task` para criação de items respeitando a hierarquia EPIC → STORY → TASK/BUG, funcionando também em projetos `SIMPLE`. Para TASK e BUG, SHALL aceitar `versionId` opcional e validar que a versão pertence ao projeto e tenant atuais.

#### Scenario: Criação de TASK órfã
- **WHEN** agente invoca `create_task` com `{ projectId, title }` sem `parentId`
- **THEN** sistema cria TASK na primeira coluna do board e retorna o objeto criado com o ID gerado

#### Scenario: Criação respeitando hierarquia completa
- **WHEN** agente cria EPIC (com `moduleId`), depois STORY (com `parentId=epicId`), depois TASK (com `parentId=storyId`)
- **THEN** cada item é criado com vínculo correto e aparece no board dentro da swimlane do EPIC

#### Scenario: Resolução automática de moduleId para EPIC
- **WHEN** agente cria EPIC sem informar `moduleId`
- **THEN** servidor busca automaticamente o primeiro módulo do projeto e o atribui ao EPIC

#### Scenario: Criação de TASK com versão
- **WHEN** agente invoca `create_task` com `type=TASK` ou `type=BUG` e `versionId` de uma versão do projeto
- **THEN** sistema cria o item com `version_id` persistido e retorna a versão associada

#### Scenario: Criação sem versão
- **WHEN** agente invoca `create_task` sem `versionId`
- **THEN** sistema cria o item normalmente com `version_id = null`

#### Scenario: Versão fora do projeto
- **WHEN** agente invoca `create_task` com `versionId` pertencente a outro projeto ou tenant
- **THEN** API rejeita a criação sem persistir o item nem revelar dados da versão

#### Scenario: Violação de hierarquia — TASK filho de EPIC
- **WHEN** agente invoca `create_task` com `type=TASK` e `parentId` apontando para item do tipo EPIC
- **THEN** servidor detecta a violação antes de chamar a API e retorna erro acionável informando o fluxo correto: criar STORY filho do EPIC e usar o ID da STORY como `parentId` da TASK

#### Scenario: Violação de hierarquia — STORY sem pai EPIC
- **WHEN** agente invoca `create_task` com `type=STORY` e `parentId` apontando para item não-EPIC
- **THEN** servidor retorna erro indicando que STORY deve ser filha de EPIC e orienta a usar `list_tasks(type=EPIC)` para obter os IDs disponíveis

#### Scenario: Decisão de granularidade pelo agente
- **WHEN** agente avalia se deve criar subtarefa (TASK filha) ou checklist em card existente
- **THEN** agente considera: subtarefa quando o trabalho é substancial (>30 min), paralelizável ou rastreável individualmente no Kanban; checklist quando os passos são fases sequenciais de uma mesma unidade de trabalho; nenhum registro quando o passo é trivial (<5 min) e não agrega valor ao observador do board

---

### Requirement: Transporte e autenticação do MCP
O servidor MCP SHALL usar transporte stdio e autenticar via API Key passada como variável de ambiente `EASYBOARD_API_KEY`. A cada chamada, SHALL resolver o Owner persistido da chave e aplicar suas permissões globais, membership local, tenant e escopos restritivos; a chave nunca SHALL conceder privilégios superiores aos do Owner.

#### Scenario: Configuração do MCP em agente de IA
- **WHEN** agente configura o servidor MCP com `EASYBOARD_API_KEY` e URL do backend
- **THEN** todas as ferramentas operam autenticadas com as permissões efetivas do Owner humano da API Key

#### Scenario: Chave não amplia privilégios
- **WHEN** API Key possui escopo de permissão mais amplo que o grupo ou membership do Owner
- **THEN** o MCP aplica a interseção restritiva e nega operações acima das permissões do Owner

#### Scenario: Estado alterado após inicialização
- **WHEN** o grupo do Owner é reduzido ou a API Key é revogada enquanto o processo MCP continua ativo
- **THEN** a próxima chamada é revalidada e perde o acesso correspondente

---

### Requirement: Ferramenta MCP list_checklists
O sistema SHALL expor ferramenta `list_checklists` que retorna todos os checklists de um card com seus itens e progresso.

#### Scenario: Agente lista checklists de um card
- **WHEN** agente invoca `list_checklists` com `{ projectId, itemId }`
- **THEN** servidor retorna array de checklists com `[{ id, name, items: [{ id, text, checked }], progress: { checked, total } }]`

#### Scenario: Card sem checklists
- **WHEN** agente invoca `list_checklists` para card sem checklists
- **THEN** servidor retorna array vazio `[]`

---

### Requirement: Ferramenta MCP create_checklist
O sistema SHALL expor ferramenta `create_checklist` para que agentes criem um checklist nomeado em um card.

#### Scenario: Agente cria checklist antes de iniciar execução
- **WHEN** agente invoca `create_checklist` com `{ projectId, itemId, name: "Plano de execução" }`
- **THEN** sistema cria o checklist e retorna `{ id, name }` para uso nas chamadas subsequentes de `add_checklist_item`

---

### Requirement: Ferramenta MCP add_checklist_item
O sistema SHALL expor ferramenta `add_checklist_item` para adicionar itens a um checklist existente.

#### Scenario: Agente adiciona passo ao plano
- **WHEN** agente invoca `add_checklist_item` com `{ projectId, itemId, checklistId, text: "Analisar requisitos" }`
- **THEN** sistema cria o item com `checked: false` e retorna `{ id, text, checked, position }`

---

### Requirement: Ferramenta MCP check_item
O sistema SHALL expor ferramenta `check_item` para marcar um item de checklist como concluído ou não-concluído. Além do caminho por `itemId` + `checklistId` + `checklistItemId`, SHALL aceitar resolução semântica por `itemId`, nome exato do checklist e texto/posição do passo. Resolução ambígua SHALL falhar de forma acionável.

#### Scenario: Agente marca passo como concluído
- **WHEN** agente invoca `check_item` com `{ projectId, itemId, checklistId, checklistItemId, checked: true }`
- **THEN** sistema atualiza `checked` e emite evento WebSocket `CHECKLIST_UPDATED`; humanos acompanhando o board veem o progresso atualizar em tempo real

#### Scenario: Agente marca passo por nome
- **WHEN** agente invoca `check_item` com `{ projectId, itemId, checklistName, text, checked: true }` e existe exatamente um checklist e item compatíveis
- **THEN** servidor resolve os IDs internamente, atualiza o passo e retorna o item atualizado

#### Scenario: Busca semântica ambígua
- **WHEN** o texto informado corresponde a mais de um passo do checklist
- **THEN** servidor não escolhe silenciosamente e retorna erro acionável com os candidatos e orientação para enviar IDs ou `position`

---

### Requirement: Suíte automatizada de regressão MCP
O sistema SHALL manter testes automatizados executáveis por `bun run test:mcp` para validar o comportamento das ferramentas MCP sem depender de servidor externo, banco ou credenciais reais.

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

### Requirement: Metadados adaptativos no registry compartilhado
O registry usado pelo MCP e Azy Agent SHALL fornecer domínio, escopo, operação, risco, dependencies, tipos de alvo e policy para cada tool, preservando nomes e schemas públicos.

#### Scenario: Busca por domínio
- **WHEN** o resolver procura capability Projects, Items ou Evidence
- **THEN** o registry retorna definições nominais compatíveis e dependency tools declaradas

#### Scenario: MCP externo
- **WHEN** cliente MCP autenticado solicita `tools/list`
- **THEN** continua recebendo o catálogo público permitido sem restrição baseada na tela do produto

### Requirement: Paridade schema-validator-executor

O catálogo SHALL falhar em teste quando metadata, campos obrigatórios, nullable, filtros, validator, policy ou dispatcher divergirem. A paridade SHALL valer para campos de topo e para nós aninhados do `inputSchema` (objetos e itens de arrays), incluindo a forma declarada do nó — objeto ou array — e não apenas a obrigatoriedade dos campos.

#### Scenario: Attachment exige item

- **WHEN** `list_attachments` é validada
- **THEN** schema e validator concordam sobre `itemId`

#### Scenario: Filtros de listagem

- **WHEN** `list_tasks` ou `get_tree` suporta um filtro no executor
- **THEN** o schema estrito e validator representam o mesmo filtro

#### Scenario: Datas de sprint

- **WHEN** `create_sprint` exige datas na execução
- **THEN** schema e validator representam a mesma obrigatoriedade

#### Scenario: Forma mínima aceita em todas as ferramentas

- **WHEN** o teste de paridade monta, para cada ferramenta, o payload que informa apenas os campos obrigatórios de topo e aninhados
- **THEN** a validação aceita o payload e a exposição do schema marca exatamente aqueles campos como obrigatórios

#### Scenario: Forma do nó de alteração confere com o validador

- **WHEN** `update_item`, `update_items`, `update_checklist`, `update_checklist_item` ou `update_item_log` declara o nó `changes`
- **THEN** o schema declara a mesma forma (objeto ou array) que o validador aceita e que o executor consome

### Requirement: Ferramentas MCP retornam erro normalizado
As ferramentas MCP SHALL preservar o contrato único de erro para falhas de validação, autorização, recurso, conflito e infraestrutura, sem emitir `error` como string ou `code` e `retryable` fora do objeto `error`.

#### Scenario: Parâmetro inválido em ferramenta MCP
- **WHEN** um agente invoca uma ferramenta com parâmetros inválidos
- **THEN** a ferramenta retorna o envelope comum com código de validação e detalhes dos campos rejeitados

#### Scenario: Erro da API durante ferramenta MCP
- **WHEN** a API HTTP retorna um erro normalizado
- **THEN** o MCP repassa o código, mensagem, retryabilidade e detalhes sem uma segunda conversão semântica

### Requirement: Campos avançados opcionais nas ferramentas MCP de checklist

As ferramentas MCP de checklist SHALL aceitar e retornar, como campos opcionais, `dueDate`, `assigneeId` e `description` quando o projeto estiver com `advancedChecklists = true`, respeitando o mesmo gate da API. A ferramenta `update_checklist_item` SHALL usar um schema de alteração próprio de item de checklist (e não o schema genérico de item), com limites e descrições semânticas documentados no catálogo. As ferramentas SHALL continuar válidas e inalteradas no comportamento quando a opção do projeto estiver desligada.

#### Scenario: Agente adiciona item com campos avançados
- **WHEN** agente invoca `add_checklist_item` (ou `add_checklist_item_to_task`) com `{ projectId, itemId, checklistId, text, dueDate?, assigneeId?, description? }` em projeto com a opção ligada
- **THEN** o servidor repassa os campos à API e retorna o item criado com os campos avançados

#### Scenario: Agente atualiza campo avançado
- **WHEN** agente invoca `update_checklist_item` com um `changes` contendo `dueDate`, `assigneeId` ou `description`
- **THEN** o servidor aceita as alterações usando o schema de item de checklist e retorna o item atualizado

#### Scenario: Agente lista checklists detalhados
- **WHEN** agente invoca `list_checklists` em projeto com a opção ligada
- **THEN** o servidor retorna os itens com os campos avançados presentes (ou `null` quando vazios)

#### Scenario: Projeto no modo simples
- **WHEN** agente tenta enviar campos avançados em projeto com `advancedChecklists = false`
- **THEN** o servidor retorna erro de validação claro e não altera o item

#### Scenario: Catálogo e limites em sincronia
- **WHEN** `bun run test:mcp-catalog` é executado após a mudança
- **THEN** todas as ferramentas de checklist permanecem documentadas no README, com schema completo, `case` no dispatcher e limites de texto coerentes

### Requirement: Schema de alteração próprio por ferramenta

Cada ferramenta de atualização SHALL declarar o schema do argumento `changes` com os campos que o respectivo executor consome, sem reutilizar o schema de alteração de outra ferramenta. `update_checklist` SHALL aceitar `name` e `position`; `update_item_log` SHALL aceitar `activity` e `durationMin`; `update_checklist_item` SHALL continuar usando o schema de item de checklist. O validador SHALL rejeitar chaves desconhecidas em `changes`.

#### Scenario: Atualizar nome e posição de checklist

- **WHEN** o agente invoca `update_checklist` com `changes` contendo `name` e/ou `position`
- **THEN** o servidor aceita as alterações e retorna a checklist atualizada

#### Scenario: Atualizar texto e duração de log de trabalho

- **WHEN** o agente invoca `update_item_log` com `changes` contendo `activity` e/ou `durationMin`
- **THEN** o servidor aceita as alterações e retorna o log atualizado

#### Scenario: Chave desconhecida em alteração é rejeitada

- **WHEN** o agente invoca `update_checklist`, `update_checklist_item` ou `update_item_log` com uma chave de `changes` fora do conjunto aceito pela ferramenta
- **THEN** o servidor retorna erro de validação identificando a chave rejeitada, sem alterar o recurso

#### Scenario: Alteração vazia não corrompe o recurso

- **WHEN** o agente invoca uma ferramenta de atualização com `changes` sem nenhum campo informado
- **THEN** o servidor trata como não informado e não altera o recurso, ou retorna erro de validação claro quando a ferramenta exige ao menos uma alteração
