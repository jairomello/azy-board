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

