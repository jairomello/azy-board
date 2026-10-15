# Spec Delta

## ADDED Requirements

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
