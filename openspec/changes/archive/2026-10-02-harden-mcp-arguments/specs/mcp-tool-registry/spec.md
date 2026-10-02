## ADDED Requirements

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
