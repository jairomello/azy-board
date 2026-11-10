# Spec Delta

## MODIFIED Requirements

### Requirement: Priorizar cards atribuídos ao usuário atual
O fluxo do agente que seleciona um próximo card MUST verificar primeiro os cards atribuídos ao usuário atual dentro do projeto e tenant correntes. Um card elegível MUST ser folha, estar em uma coluna iniciável (`PLANNED`, ou `NOT_STARTED` fora do `Backlog`) e não estar concluído, arquivado ou bloqueado. Havendo candidatos próprios, o agente MUST selecionar entre eles antes de considerar cards sem atribuição. A atribuição existente MUST ser preservada.

#### Scenario: Existe card elegível atribuído ao usuário atual
- **WHEN** o agente procura um próximo card e há ao menos um card folha iniciável atribuído à identidade atual
- **THEN** o agente escolhe um dos cards atribuídos antes de qualquer card sem atribuição

#### Scenario: Card planejado é elegível
- **WHEN** o card atribuído ao usuário atual está em coluna com `baseStatus = PLANNED`
- **THEN** o card é considerado elegível, como os cards `NOT_STARTED` fora do Backlog

#### Scenario: Card no backlog não é elegível
- **WHEN** o único card atribuído ao usuário atual está na coluna `Backlog`
- **THEN** o agente não o seleciona e segue para cards disponíveis sem responsável

#### Scenario: Não há card elegível atribuído ao usuário atual
- **WHEN** o agente procura um próximo card e nenhum card atribuído à identidade atual é elegível
- **THEN** o agente mantém o fluxo de seleção atual para cards disponíveis sem responsável

#### Scenario: Card atribuído a outra pessoa
- **WHEN** um card iniciável está atribuído a outro usuário
- **THEN** o agente não o seleciona para claim nem altera sua atribuição
