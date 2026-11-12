# Spec Delta

## MODIFIED Requirements

### Requirement: Schema e validação derivados

O schema exposto ao cliente MCP e ao modo estrito SHALL ser derivado do mesmo descritor usado pela validação de argumentos. O servidor NÃO SHALL manter uma tabela de campos obrigatórios em arquivo separado da definição do catálogo. Uma ferramenta sem obrigatórios e uma ferramenta com obrigatórios SHALL ser tratadas de forma consistente entre exposição e validação.

Os enums de status expostos no catálogo SHALL listar todos os valores aceitos pelo domínio, incluindo `IN_HOMOLOGATION`; `baseStatus` de `create_column` SHALL declarar o enum completo de status base. A validação de argumentos SHALL aceitar exatamente os mesmos valores.

A exposição ao cliente MCP SHALL refletir a obrigatoriedade real do campo em qualquer profundidade do `inputSchema`, incluindo propriedades de objetos e itens de arrays aninhados. O modo estrito SHALL continuar declarando todos os campos em `required` com tipos anuláveis.

#### Scenario: Schema e validação concordam

- **WHEN** um cliente consulta a lista de ferramentas e depois envia argumentos
- **THEN** os campos exigidos na exposição são exatamente os exigidos pela validação de argumentos

#### Scenario: Status de homologação aceito

- **WHEN** um agente envia `status: "IN_HOMOLOGATION"` em `update_item` ou `create_task`
- **THEN** a validação aceita o valor e a chamada prossegue

#### Scenario: Campo opcional omitido é aceito

- **WHEN** um campo opcional é omitido ou enviado como null
- **THEN** a validação trata o valor como não informado e a chamada prossegue, sem exigir o campo

#### Scenario: Campo opcional aninhado omitido é aceito

- **WHEN** um cliente invoca `update_items` informando apenas `matchAll` e `sprint` em `filters`, omitindo os demais campos de `filters` e os campos opcionais de cada item de `changes`
- **THEN** a exposição do schema não exige os campos omitidos e a validação aceita a chamada

#### Scenario: Campo opcional aninhado enviado como null é aceito

- **WHEN** um cliente envia `null` em um campo opcional de `filters` ou de um item de `changes`
- **THEN** a validação trata o valor como não informado e a chamada prossegue

#### Scenario: Modo estrito preserva a obrigatoriedade total

- **WHEN** o harness do Azy Agent monta as ferramentas com `strict: true`
- **THEN** o schema interno mantém todos os campos de topo e aninhados em `required`, com tipos anuláveis

#### Scenario: Divergência entre schema e validação reprova o gate

- **WHEN** um teste de contrato detecta um campo obrigatório no schema que a validação não exige, ou o inverso
- **THEN** o teste falha antes do merge, impedindo a divergência
