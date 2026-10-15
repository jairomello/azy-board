# mcp-tool-registry Specification

## Purpose
Definir o catálogo compartilhado de ferramentas MCP, seus schemas, policies, routing e contratos de resposta.
## Requirements
### Requirement: Fonte única de verdade por ferramenta

O catálogo de ferramentas SHALL definir cada ferramenta em um único descritor que declara, no mesmo ponto, nome, descrição, campos aceitos (com tipo, obrigatoriedade, limites e texto de ajuda), routing, policy e forma da resposta. A fonte única SHALL viver em `packages/tool-registry` (`@azy-board/tool-registry`), acessível por API e MCP via nome de package. Nenhuma outra estrutura SHALL manter listas paralelas de campos obrigatórios, campos por ferramenta, classificação de routing, limites ou shape de resposta que precisem ser editadas separadamente.

#### Scenario: Campo obrigatório declarado uma única vez

- **WHEN** um campo de uma ferramenta passa a ser obrigatório ou deixa de ser
- **THEN** a mudança é feita apenas no descritor da ferramenta em `packages/tool-registry` e se reflete no schema exposto, na validação de argumentos e no catálogo interno sem edição adicional

#### Scenario: Inclusão de nova ferramenta

- **WHEN** uma ferramenta nova é adicionada ao catálogo
- **THEN** ela passa a aparecer na listagem, na validação e no routing a partir do próprio descritor no package, sem tabelas auxiliares a atualizar

#### Scenario: Ferramenta sem descritor falha explicitamente

- **WHEN** existe um executor de ferramenta sem descritor correspondente no catálogo
- **THEN** a verificação de contrato falha e aponta a ferramenta sem definição, em vez de aceitá-la silenciosamente

### Requirement: Schema e validação derivados

O schema exposto ao cliente MCP e ao modo estrito SHALL ser derivado do mesmo descritor usado pela validação de argumentos. O servidor NÃO SHALL manter uma tabela de campos obrigatórios em arquivo separado da definição do catálogo. Uma ferramenta sem obrigatórios e uma ferramenta com obrigatórios SHALL ser tratadas de forma consistente entre exposição e validação.

A exposição ao cliente MCP SHALL refletir a obrigatoriedade real do campo em qualquer profundidade do `inputSchema`, incluindo propriedades de objetos e itens de arrays aninhados. O modo estrito SHALL continuar declarando todos os campos em `required` com tipos anuláveis.

#### Scenario: Schema e validação concordam

- **WHEN** um cliente consulta a lista de ferramentas e depois envia argumentos
- **THEN** os campos exigidos na exposição são exatamente os exigidos pela validação de argumentos

#### Scenario: Campo opcional omitido é aceito

- **WHEN** um campo opcional é omitido ou enviado como null
- **THEN** a validação trata o valor como não informado e a chamada prossegue, sem exigir o campo

#### Scenario: Divergência entre schema e validação reprova o gate

- **WHEN** um teste de contrato detecta um campo obrigatório no schema que a validação não exige, ou o inverso
- **THEN** o teste falha antes do merge, impedindo a divergência

#### Scenario: Campo opcional aninhado omitido é aceito

- **WHEN** um cliente invoca `update_items` informando apenas `matchAll` e `sprint` em `filters`, omitindo os demais campos de `filters` e os campos opcionais de cada item de `changes`
- **THEN** a exposição do schema não exige os campos omitidos e a validação aceita a chamada

#### Scenario: Campo opcional aninhado enviado como null é aceito

- **WHEN** um cliente envia `null` em um campo opcional de `filters` ou de um item de `changes`
- **THEN** a validação trata o valor como não informado e a chamada prossegue

#### Scenario: Modo estrito preserva a obrigatoriedade total

- **WHEN** o harness do Azy Agent monta as ferramentas com `strict: true`
- **THEN** o schema interno mantém todos os campos de topo e aninhados em `required`, com tipos anuláveis

### Requirement: Routing e classificação derivados do descritor

A classificação de cada ferramenta — domínio, escopo, operação, risco, dependências e telas suportadas — SHALL ser declarada no descritor ou derivada deterministicamente dela. NÃO SHALL existir conjuntos manuais de nomes de ferramentas usados apenas para classificar routing em paralelo ao catálogo.

#### Scenario: Routing consultável por ferramenta

- **WHEN** o harness ou o roteamento de ferramentas precisa saber o domínio, escopo, operação e risco de uma ferramenta
- **THEN** obtém esses dados a partir da definição da ferramenta, sem consultar listas de nomes separadas

#### Scenario: Classificação consistente após renomear

- **WHEN** uma ferramenta é renomeada no descritor
- **THEN** sua classificação acompanha o novo nome sem exigir atualização de conjuntos manuais

### Requirement: Contrato do catálogo verificado no CI

O projeto SHALL manter verificações automatizadas que garantam que catálogo, schema, validação, routing, limites, projeções e respostas permanecem derivados da fonte única em `packages/tool-registry`, e SHALL executá-las no pipeline de integração contínua. Os testes de contrato (`registry-contract`, `optional-fields`) SHALL cobrir shapes de resposta, orçamento de payload e novos fluxos de checklist.

#### Scenario: Catálogo sem código morto

- **WHEN** a verificação de catálogo roda
- **THEN** ela reprova se encontrar estruturas de definição duplicadas ou ramos inalcançáveis que possam divergir do descritor

#### Scenario: Ferramentas obrigatórias presentes

- **WHEN** a verificação de catálogo roda
- **THEN** ela confirma que todas as ferramentas expostas têm descritor, policy e executor, e que não há descritor sem executor

#### Scenario: Testes de contrato no package

- **WHEN** `bun test packages/tool-registry` roda
- **THEN** os testes de unicidade e consistência do catálogo passam

### Requirement: Projeção e resposta declaradas no catálogo
O descritor de `list_tasks` SHALL declarar projeção, limite, relações achatadas e campos permitidos; descritores de mutação SHALL declarar a separação entre identidade, mudanças aplicadas e resumo agregado quando aplicável.

#### Scenario: Orçamento de payload protegido
- **WHEN** o teste de catálogo mede uma resposta padrão de `list_tasks`
- **THEN** reprova se descrições completas ou relações aninhadas excederem o orçamento definido para a resposta leve

### Requirement: Fluxos de checklist no catálogo
O catálogo SHALL declarar a ferramenta `check_items`, seus limites, policy, routing e shape de resposta, mantendo os caminhos semânticos e por IDs consistentes entre schema, validação e executor.

#### Scenario: Testes de contrato no package
- **WHEN** `bun test packages/tool-registry` roda
- **THEN** os testes de unicidade, consistência, projeção, resposta e shapes de checklist passam

### Requirement: Obrigatoriedade real por nó aninhado declarada no catálogo

O descritor de cada ferramenta SHALL declarar a lista de campos realmente obrigatórios de cada nó aninhado do `inputSchema` (objetos e itens de arrays), no mesmo lugar em que declara os campos de topo. A exposição ao cliente MCP SHALL derivar o `required` de cada nó dessa declaração. Nenhuma estrutura SHALL inferir a obrigatoriedade aninhada a partir de "todos os campos do nó".

#### Scenario: Declaração por nó convive com o modo estrito

- **WHEN** um nó aninhado declara apenas parte dos seus campos como obrigatórios
- **THEN** a exposição ao cliente MCP exige apenas essa parte e o modo estrito continua exigindo todos os campos do nó

#### Scenario: Caminho declarado inexistente reprova o contrato

- **WHEN** um teste de contrato encontra uma declaração de nó aninhado cujo caminho não existe mais no schema da ferramenta
- **THEN** o teste falha e aponta o caminho órfão, em vez de ignorá-lo silenciosamente

#### Scenario: Nó sem declaração mantém o comportamento atual

- **WHEN** um nó aninhado não possui declaração de obrigatoriedade
- **THEN** a exposição mantém o `required` original daquele nó, sem mudança silenciosa

### Requirement: Mensagem de validação cita a forma mínima aceita

Quando a validação de argumentos rejeitar um objeto ou array aninhado, a mensagem SHALL citar a forma mínima aceita para aquele nó, além do motivo da rejeição. A mensagem SHALL seguir o contrato único de erro e identificar o nó pelo seu caminho no argumento.

#### Scenario: Filtros sem critério citam a forma mínima

- **WHEN** `update_items` é chamada com `filters` sem nenhum filtro e sem `matchAll: true`
- **THEN** a mensagem informa o motivo e mostra a forma mínima aceita para `filters`

#### Scenario: Item de alteração incompleto cita a forma mínima

- **WHEN** `update_items` ou `update_item` é chamada com um item de `changes` sem `field` ou sem `operation`
- **THEN** a mensagem identifica o caminho do item e mostra a forma mínima aceita para `changes`

### Requirement: Coerção de tipos guiada pelo schema

O executor compartilhado SHALL coergir argumentos de entrada conforme o tipo declarado no schema do catálogo antes da validação: string numérica em campo `number`, `"true"`/`"false"` em campo `boolean`, e string JSON válida em campo `array`/`object`. A coerção SHALL ser recursiva para propriedades de objetos aninhados e entradas de arrays declarados no schema, SHALL ser idempotente para valores já corretos e NÃO SHALL alterar strings de texto, data ou identificador. Quando o parse de uma string JSON falhar, o valor original SHALL ser preservado para que a validação produza o erro acionável existente.

#### Scenario: Número entregue como string

- **WHEN** um cliente invoca `list_tasks` com `limit: "50"`
- **THEN** o executor trata o valor como o número 50 e a chamada prossegue normalmente

#### Scenario: Booleano entregue como string

- **WHEN** um cliente invoca `list_tasks` com `onlyLeaves: "false"`
- **THEN** o executor trata o valor como o booleano `false` (sem semântica truthy de string) e a consulta inclui itens não-folha

#### Scenario: Array entregue como string JSON

- **WHEN** um cliente invoca `list_tasks` com `fields: '["id","title","status"]'`
- **THEN** o executor trata o valor como o array `["id","title","status"]` e a projeção é aplicada

#### Scenario: String JSON inválida preserva o erro acionável

- **WHEN** um cliente envia um campo `array` com string que não é JSON válido
- **THEN** a coerção não altera o valor e a validação rejeita com a mensagem existente (forma mínima aceita)

#### Scenario: Entrada aninhada é coerida

- **WHEN** um cliente invoca `check_items` com `items: [{ itemId, checked: "true", position: "3", checklistName }]`
- **THEN** `checked` e `position` chegam à validação e ao executor como booleano e número

#### Scenario: Valores corretos não mudam

- **WHEN** os argumentos já possuem os tipos declarados no schema
- **THEN** a coerção não produz nenhuma alteração (idempotente)

### Requirement: Argumentos desconhecidos são rejeitados

A validação de argumentos SHALL rejeitar campos de topo não declarados no catálogo da ferramenta com erro acionável que cita o campo recebido e lista os campos aceitos. Campos internos de passthrough (`atomic`, `idempotencyKey`, `agentRunId`) SHALL ser permitidos. O erro SHALL seguir o contrato unificado (code, message, retryable, details.path) e NÃO SHALL ser retryable.

#### Scenario: Campo inexistente na ferramenta

- **WHEN** um cliente invoca `list_tasks` com `titleContains: "x"` (campo que pertence a `update_items.filters`)
- **THEN** a validação rejeita com mensagem citando `titleContains` e os campos aceitos de `list_tasks`, e nenhum dado é retornado

#### Scenario: Passthrough interno permitido

- **WHEN** o harness do Azy Agent injeta `atomic: true` nos argumentos de `batch`
- **THEN** a validação aceita o campo e o lote executa em modo atômico

#### Scenario: Detalhes do erro apontam o campo

- **WHEN** a rejeição por campo desconhecido chega ao cliente MCP
- **THEN** a resposta tem `error.code`, `error.retryable: false` e `details.path` igual ao campo rejeitado

### Requirement: Harness do agente coerge antes de aprovar

O harness do Azy Agent SHALL aplicar a mesma coerção antes da pré-validação e SHALL persistir os argumentos coeridos, de modo que preview de aprovação, hash de operação e execução utilizem exatamente o mesmo payload.

#### Scenario: Aprovação e execução usam o mesmo valor

- **WHEN** o modelo do agente emite `points: "3"` em uma operação de `batch`
- **THEN** o preview de aprovação exibe `points: 3` e a execução aprovada usa o mesmo valor numérico

### Requirement: Duração no descritor de criação de apontamento

O descritor de `create_item_log` SHALL declarar `durationMin` (inteiro não-negativo de minutos, opcional) e `duration` (string humano-legível, opcional) como campos do catálogo, permanecendo a fonte única de schema, validação, normalização e descrição. A normalização de `duration` para `durationMin` SHALL ocorrer antes da validação de negócio, do preview de aprovação, do hash de operação e da execução. O parser SHALL aceitar `H:MM`, `Nh`, `NhMM`, `N`, `Nmin` e `Nm`, rejeitando valores negativos, minutos `> 59` quando houver separador de hora e entradas inválidas. Quando `durationMin` e `duration` forem informados simultaneamente e os minutos divergirem, a validação SHALL rejeitar com erro acionável citando os dois valores. O parser do caminho de ferramenta NÃO SHALL alterar o contrato `H:MM` do formulário do Diário.

#### Scenario: Campo de duração exposto como opcional

- **WHEN** o schema exposto de `create_item_log` é inspecionado
- **THEN** `durationMin` e `duration` aparecem como opcionais e a forma mínima continua exigindo apenas `projectId`, `itemId` e `activity`

#### Scenario: Duração legível normalizada antes do preview

- **WHEN** `create_item_log` recebe `duration: "1h30"`
- **THEN** a canonicalização produz `durationMin: 90` antes da validação, do preview de aprovação e do hash da operação

#### Scenario: Formatos aceitos

- **WHEN** `duration` é `"90"`, `"1h"`, `"1:30"`, `"90min"` ou `"1h30min"`
- **THEN** a normalização produz respectivamente 90, 60, 90, 90 e 90 minutos

#### Scenario: Duração inválida é rejeitada de forma acionável

- **WHEN** `durationMin` é negativo ou `duration` não corresponde a nenhum formato aceito
- **THEN** a validação rejeita a chamada, cita o valor recebido e o formato aceito, e nenhum apontamento é criado

#### Scenario: Conflito entre representações é rejeitado

- **WHEN** a chamada informa `durationMin: 30` e `duration: "1h"`
- **THEN** a validação rejeita com mensagem citando os dois valores, sem executar a criação

#### Scenario: Paridade entre schema, validação e executor

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados e dispatcher concordam sobre `durationMin`/`duration` em `create_item_log`

### Requirement: Descritor da ferramenta read_attachment

O catálogo compartilhado SHALL declarar a ferramenta `read_attachment` no mesmo descritor único usado por schema, validação, routing, policy e executor, exigindo `projectId`, `itemId` e `attachmentId`, com policy de leitura (`VIEWER`) e classificação `{ domain: 'evidence', scope: 'item', operation: 'read' }`. A descrição SHALL deixar explícitos os formatos textuais suportados, a existência de limites de leitura e a regra de que formatos não interpretáveis são declarados como não suportados.

#### Scenario: Campos e obrigatoriedade coerentes

- **WHEN** o schema exposto e a validação de `read_attachment` são inspecionados
- **THEN** `projectId`, `itemId` e `attachmentId` aparecem como obrigatórios e não há campos paralelos fora do descritor

#### Scenario: Classificação de leitura

- **WHEN** o routing consulta `read_attachment`
- **THEN** obtém domínio Evidence, escopo item, operação read e risco derivado de leitura, sem exigir aprovação de mutação

#### Scenario: Formato não suportado é declarado

- **WHEN** a descrição e o schema de resposta de `read_attachment` são documentados no catálogo
- **THEN** fica explícito que formatos não interpretáveis retornam `unsupported` e que a leitura é limitada, sem prometer OCR ou leitura de qualquer arquivo

### Requirement: Schema de resposta da leitura de anexo

O descritor de `read_attachment` SHALL declarar a forma da resposta de leitura, contendo a identificação do anexo, `format`, `text`, `encoding`, `totalBytes`, `readBytes`, `charCount`, `truncated`, `reason` e `nextOffset` quando aplicável, e SHALL ser verificado pelo contrato do catálogo junto das demais ferramentas.

#### Scenario: Contrato do catálogo cobre a nova ferramenta

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** `read_attachment` possui descritor, policy, routing, campos e shape de resposta consistentes, sem descritor órfão nem executor sem definição

#### Scenario: Forma mínima aceita

- **WHEN** o teste de paridade monta o payload mínimo de `read_attachment`
- **THEN** a validação aceita exatamente `projectId`, `itemId` e `attachmentId` e o schema marca apenas esses três como obrigatórios

### Requirement: Ferramentas de links do item no catálogo

O catálogo compartilhado SHALL declarar as ferramentas `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link` como fonte única de campos, schema, validação, policy, classificação e descrição. `list_item_links` e `delete_item_link` SHALL exigir `projectId` e `itemId` (e `linkId` em delete); `create_item_link` SHALL exigir `name` e `url` e aceitar `description` opcional; `update_item_link` SHALL exigir `linkId` e pelo menos um de `name`/`url`/`description`. A validação SHALL aceitar apenas URL `http`/`https` sem credenciais embutidas, com nome ≤ 200, URL ≤ 2048 e descrição ≤ 20000, e SHALL rejeitar `linkId` vazio. As ferramentas SHALL ser classificadas como `domain: 'evidence'`, `scope: 'item'`, com operação `read`/`create`/`update`/`delete`, e `list_item_links` SHALL integrar o conjunto de descoberta. A documentação gerada SHALL listar as quatro ferramentas.

#### Scenario: Campos obrigatórios e opcionais declarados

- **WHEN** os schemas expostos das quatro ferramentas de link são inspecionados
- **THEN** a forma mínima exige exatamente `projectId`/`itemId` em `list_item_links` e `delete_item_link`, `projectId`/`itemId`/`name`/`url` em `create_item_link` e `projectId`/`itemId`/`linkId` em `update_item_link`, com `description`, `name` e `url` opcionais onde aplicável

#### Scenario: URL válida é aceita e inválida é rejeitada de forma acionável

- **WHEN** `create_item_link` recebe uma URL `http`/`https` sem usuário/senha
- **THEN** a validação aceita a chamada; quando a URL é inválida, usa outro esquema ou contém credenciais, a validação rejeita citando valor recebido e formato aceito, sem executar a mutação

#### Scenario: Edição sem nenhum campo é rejeitada

- **WHEN** `update_item_link` é chamado apenas com `projectId`, `itemId` e `linkId`
- **THEN** a validação rejeita exigindo ao menos um de `name`, `url` ou `description`

#### Scenario: `linkId` inválido é rejeitado

- **WHEN** `update_item_link` ou `delete_item_link` recebe `linkId` vazio ou não textual
- **THEN** a validação rejeita antes da execução

#### Scenario: Classificação e policy coerentes

- **WHEN** as quatro ferramentas são carregadas do registry
- **THEN** `list_item_links` é leitura com policy `read`, as demais são escrita com policy `write`, e todas têm domínio `evidence`, escopo `item` e operação correspondente

#### Scenario: Paridade entre schema, validação e dispatcher

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados, classificação e dispatcher concordam sobre as quatro ferramentas de link, e o README gerado as documenta

### Requirement: Descritores de edição de sprint e versão no catálogo

O catálogo compartilhado SHALL declarar as ferramentas `update_sprint` e `update_version` como fonte única de campos, schema, validação, routing, classificação e policy. Cada uma SHALL receber `projectId`, o identificador da entidade (`sprintId`/`versionId`) e `changes`, um array de alterações `{ field, operation, value }` com operação `SET` ou `CLEAR`. O schema de `changes` SHALL ser próprio de cada ferramenta: `update_sprint` aceita `name`, `startDate` e `endDate`; `update_version` aceita `name`, `releaseDate`, `description` e `status`. A classificação SHALL ser domínio `planning`, escopo `project`, operação `update` e a policy `ADMIN`, coerente com as rotas de edição. A validação SHALL rejeitar `changes` vazio, `operation` desconhecida, `CLEAR` em campo não anulável e `status` fora do enum, sem persistência parcial.

#### Scenario: Ferramenta de edição exposta com forma mínima

- **WHEN** o schema exposto de `update_sprint` ou `update_version` é inspecionado
- **THEN** `projectId`, o identificador da entidade e `changes` aparecem como obrigatórios, e cada item de `changes` exige `field` e `operation`

#### Scenario: Campos permitidos por ferramenta

- **WHEN** `update_version` recebe `changes` com `field` igual a `releaseDate` e `update_sprint` recebe `field` igual a `endDate`
- **THEN** a validação aceita as alterações e o schema declarado reflete exatamente esses campos por ferramenta

#### Scenario: CLEAR em campo não anulável é rejeitado

- **WHEN** `update_sprint` recebe `changes` com `operation: CLEAR` para `name`, `startDate` ou `endDate`
- **THEN** a validação rejeita com erro acionável citando o campo e a operação aceita, sem alterar a sprint

#### Scenario: Alteração vazia é rejeitada

- **WHEN** `update_sprint` ou `update_version` é chamada com `changes` vazio
- **THEN** a validação rejeita a chamada informando a forma mínima aceita, sem executar a edição

#### Scenario: Paridade entre schema, validação e executor

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados e dispatcher concordam sobre `update_sprint` e `update_version`

### Requirement: Criação de versão com campos completos no catálogo

O descritor de `create_version` SHALL aceitar, além de `name` obrigatório, os campos opcionais `releaseDate`, `description` e `status`, alinhado ao que `POST /projects/:id/versions` já aceita. `status` SHALL ser restrito ao enum `PLANNED`, `IN_DEV`, `RELEASED` e `CANCELLED`. A criação informando apenas `name` SHALL continuar válida e inalterada.

#### Scenario: Campos opcionais de criação expostos

- **WHEN** o schema exposto de `create_version` é inspecionado
- **THEN** `releaseDate`, `description` e `status` aparecem como opcionais e a forma mínima continua exigindo apenas `projectId` e `name`

#### Scenario: Criação só com nome permanece válida

- **WHEN** `create_version` é chamada apenas com `projectId` e `name`
- **THEN** a validação aceita a chamada e a versão é criada com os defaults da API

### Requirement: Filtro de janela de alteração em list_tasks

O catálogo compartilhado SHALL declarar em `list_tasks` um campo de filtro por janela de última alteração, como fonte única de schema, validação e descrição. O campo SHALL aceitar os valores `1d`, `2d`, `3d`, `5d`, `1w`, `1m` e `current-sprint`, SHALL ser opcional e SHALL rejeitar valores fora do conjunto com erro acionável que cita o valor recebido e as opções aceitas.

#### Scenario: Campo exposto como opcional

- **WHEN** o schema exposto de `list_tasks` é inspecionado
- **THEN** o campo de janela de alteração aparece como opcional e a forma mínima continua exigindo apenas `projectId`

#### Scenario: Valor válido aceito

- **WHEN** o agente chama `list_tasks` com a janela `3d`
- **THEN** a validação aceita e a consulta retorna apenas itens alterados desde 00:00 de 3 dias atrás (fuso do projeto)

#### Scenario: Valor inválido rejeitado

- **WHEN** `list_tasks` recebe um valor de janela fora do conjunto aceito
- **THEN** a validação rejeita citando o valor recebido e as opções aceitas, sem consultar itens

#### Scenario: Paridade entre schema, validação e executor

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados e dispatcher concordam sobre o filtro de alteração em `list_tasks`

### Requirement: Opções de visibilidade de níveis nas ferramentas de projeto

As ferramentas `create_project`, `update_project` e `create_project_structure` SHALL aceitar `hideModules` e `hideEpics` como booleanos opcionais (anuláveis no modo estrito), cada um com descrição no schema exposto. Os valores SHALL seguir a semântica do REST: valem só em `HIERARCHICAL`, ficam `false` em `SIMPLE` e, em `update_project`, ligar a opção SHALL recolher a hierarquia. Valor não boolean SHALL ser rejeitado com erro acionável, e campos de topo não declarados SHALL seguir rejeitados.

#### Scenario: Criação com as opções

- **WHEN** o agente chama `create_project` com `hideModules` e/ou `hideEpics` em um projeto `HIERARCHICAL`
- **THEN** o projeto é criado com os valores informados e `get_project` devolve os dois campos

#### Scenario: Criação sem as opções

- **WHEN** o agente chama `create_project` sem informar `hideModules` nem `hideEpics`
- **THEN** o projeto é criado com ambos em `false`, sem exigir que o agente pergunte pelos campos

#### Scenario: Projeto simples nunca oculta níveis

- **WHEN** o agente chama `create_project` com `boardMode = SIMPLE` e alguma das opções em `true`
- **THEN** o projeto é persistido com `hideModules` e `hideEpics` em `false`

#### Scenario: Ligar a opção recolhe a hierarquia

- **WHEN** o agente chama `update_project` ligando `hideModules` ou `hideEpics` em um projeto `HIERARCHICAL`
- **THEN** a hierarquia é recolhida como no REST, com o patch aplicado na mesma operação e os demais campos do projeto preservados

#### Scenario: Reenvio idempotente da edição

- **WHEN** a mesma chamada de `update_project` com a opção já ligada é repetida
- **THEN** nenhum recolhimento adicional ocorre e o resultado observável permanece o mesmo

#### Scenario: Valor não booleano é rejeitado

- **WHEN** o agente envia `hideModules` com um valor que não é boolean nem `true`/`false` textual
- **THEN** a chamada falha com erro de validação acionável, apontando o campo, e nenhum projeto é alterado

#### Scenario: Campo não declarado continua rejeitado

- **WHEN** o agente envia em `create_project` um campo de topo que não pertence ao catálogo
- **THEN** a chamada é rejeitada, preservando a política de campos declarados

#### Scenario: Catálogo exposto documenta as opções

- **WHEN** um cliente lista as ferramentas do MCP
- **THEN** `create_project`, `update_project` e `create_project_structure` expõem `hideModules` e `hideEpics` como campos opcionais, cada um com descrição de uso

#### Scenario: Criação de estrutura propaga as opções

- **WHEN** o agente chama `create_project_structure` informando `hideModules` e/ou `hideEpics`
- **THEN** o projeto criado pela ferramenta nasce com os valores informados, junto da estrutura solicitada

### Requirement: Pré-visualização de exclusão de projeto

A ferramenta `delete_project` SHALL aceitar `dryRun` como booleano opcional, com descrição no schema exposto, e SHALL encaminhá-lo ao `DELETE /projects/:id`. Com `dryRun` verdadeiro, a chamada SHALL devolver a pré-visualização com as contagens dos registros filhos do projeto e NÃO SHALL excluir nada. Valor não booleano SHALL ser rejeitado com erro acionável que cita o campo. Sem o campo, a exclusão SHALL manter o comportamento atual.

#### Scenario: Pré-visualização não exclui

- **WHEN** o agente chama `delete_project` com `dryRun: true` em um projeto existente
- **THEN** a resposta traz a pré-visualização com as contagens dos registros filhos do projeto e o projeto permanece intacto

#### Scenario: Exclusão real preservada

- **WHEN** o agente chama `delete_project` sem `dryRun` (ou com `dryRun: false`) em um projeto que pode excluir
- **THEN** o projeto e os registros dependentes são excluídos como hoje, e a lista de projetos deixa de exibi-lo

#### Scenario: Valor não booleano é rejeitado

- **WHEN** o agente envia `dryRun` com um valor que não é boolean nem `true`/`false` textual
- **THEN** a chamada falha com erro de validação acionável apontando o campo, sem excluir nem pré-visualizar

#### Scenario: Catálogo exposto declara o campo

- **WHEN** um cliente lista as ferramentas do MCP
- **THEN** `delete_project` expõe `dryRun` como campo opcional com descrição de uso, mantendo `projectId` como único obrigatório

#### Scenario: Exclusão continua exigindo permissão

- **WHEN** o agente sem papel ADMIN no projeto tenta `delete_project` (com ou sem `dryRun`)
- **THEN** a operação é recusada e nenhum registro é alterado

### Requirement: Campos de token no catálogo de itens

O catálogo SHALL declarar `tokensInput` e `tokensOutput` como campos de alteração de
`update_item`/`update_items` (operações `SET` e `CLEAR`, inteiro não-negativo) e como
campos de projeção de leitura do item, derivando o total de tokens na resposta.

#### Scenario: Alteração de token pelo catálogo

- **WHEN** `update_item` recebe `changes` com `tokensInput`/`tokensOutput` em `SET`
- **THEN** a validação aceita inteiros não-negativos, rejeita negativos com erro
  acionável e a resposta ecoa os valores aplicados e o total derivado

#### Scenario: Tokens na projeção de `list_tasks`

- **WHEN** `list_tasks` projeta campos de token ou retorna o item completo
- **THEN** a resposta inclui os campos de token e o total derivado, mantendo o orçamento
  de payload e a forma do resumo de item

#### Scenario: Campo fora do catálogo

- **WHEN** uma chamada usa um campo de token não declarado no descritor da ferramenta
- **THEN** a validação rejeita com o erro acionável padrão, citando o campo aceito

### Requirement: Ferramenta em lote `set_item_tokens`

O catálogo SHALL declarar `set_item_tokens` no descritor único, exigindo `projectId` e
`items` (lista de `itemId` mais valores de token), com validação, policy de escrita e
classificação `{ domain: 'evidence', scope: 'item', operation: 'update' }`. Cada item do
lote SHALL ser aplicado de forma atômica e independente, e a ferramenta SHALL integrar a
documentação gerada.

#### Scenario: Lote válido aplicado por item

- **WHEN** `set_item_tokens` recebe vários itens com valores distintos
- **THEN** cada card recebe o seu valor e a resposta identifica os itens atualizados

#### Scenario: Falha isolada por item

- **WHEN** um item do lote é inválido (valor negativo, card inexistente ou fora do tenant)
- **THEN** a resposta reporta a falha daquele item sem impedir a aplicação dos válidos

#### Scenario: Documentação e verificação do catálogo

- **WHEN** a verificação de contrato do catálogo roda
- **THEN** `set_item_tokens` aparece em schema, validação, routing, policy e documentação

### Requirement: Aviso de tokens ausentes em `complete_task`

A resposta de `complete_task` SHALL incluir um aviso não bloqueante quando o card for
concluído sem tokens registrados e houver indício de execução por agente. O aviso NÃO
SHALL impedir a conclusão nem mover o card.

#### Scenario: Conclusão de card de agente sem tokens

- **WHEN** um card executado por agente é concluído sem tokens registrados
- **THEN** a conclusão ocorre normalmente e a resposta traz um aviso sugerindo registrar
  os tokens

#### Scenario: Card com tokens ou sem indício de IA

- **WHEN** o card já possui tokens ou não há indício de execução por agente
- **THEN** a resposta de conclusão não inclui o aviso
