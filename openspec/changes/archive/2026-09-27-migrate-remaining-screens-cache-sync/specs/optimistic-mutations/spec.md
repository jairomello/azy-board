## ADDED Requirements

### Requirement: Política única de mutação vale para as telas de dados migradas
As mutações das telas de dados migradas (Settings, Projects, TreeView, AdminUsers e ApiKeys) SHALL seguir exatamente um dos dois padrões da política única de mutação: **otimista** — aplica o estado local a partir de um snapshot capturado antes da operação e restaura esse snapshot em falha; ou **reconciliada** — aplica o estado somente após a resposta de sucesso, ou invalida/refaz a consulta. O padrão padrão dessas telas SHALL ser o reconciliado.

#### Scenario: Mutação reconciliada de tela migrada não antecipa estado
- **WHEN** uma criação, edição ou exclusão em Settings, AdminUsers ou ApiKeys ainda não recebeu resposta
- **THEN** o cache não é alterado antes do sucesso

#### Scenario: Falha em mutação de tela migrada não deixa cache divergente
- **WHEN** uma mutação de tela migrada falha na API
- **THEN** o cache permanece no estado anterior (ou restaura o snapshot) e o usuário é avisado do erro

#### Scenario: Exclusão que falha é comunicada
- **WHEN** a exclusão de um registro em uma tela migrada falha
- **THEN** o usuário é avisado e o estado exibido corresponde ao do servidor
