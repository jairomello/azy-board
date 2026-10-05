## MODIFIED Requirements

### Requirement: Ícone e cor default

O sistema SHALL definir um ícone default de projeto e um ícone default de item, aplicados sempre que o registro não tiver ícone personalizado, e SHALL aplicar a cor padrão do tema quando não houver cor personalizada. O ícone default de projeto e a cor padrão NÃO SHALL ser persistidos no banco. O ícone default de item (`DEFAULT_ITEM_ICON`) SHALL ser **persistido na criação de cards (TASK/BUG) sem ícone**, de forma determinística, para que todo card criado tenha ícone; `null` explícito na edição continua limpando o campo.

#### Scenario: Projeto sem ícone usa o default

- **WHEN** um projeto possui `icon = null`
- **THEN** a interface exibe o ícone default de projeto

#### Scenario: Item com ícone limpo usa o default

- **WHEN** um item possui `icon = null` (nunca definido ou limpo explicitamente)
- **THEN** a interface exibe o ícone default de item e a API retorna `icon = null`

#### Scenario: Criação de card sem ícone persiste o default

- **WHEN** um card (TASK/BUG) é criado sem informar `icon`
- **THEN** o sistema persiste o ícone default de item e o retorna na resposta

#### Scenario: Ícone explícito tem precedência

- **WHEN** um card é criado informando `icon` válido (ou `icon: null`)
- **THEN** o sistema usa o valor informado e não aplica o default automático

#### Scenario: Sem cor, usa a cor padrão do tema

- **WHEN** projeto ou item possui `color = null`
- **THEN** a interface renderiza o ícone com a cor padrão do tema
