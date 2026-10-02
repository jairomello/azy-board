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
