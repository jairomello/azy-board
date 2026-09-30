## MODIFIED Requirements

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

## ADDED Requirements

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
