## ADDED Requirements

### Requirement: Priorizar cards atribuídos ao usuário atual
O fluxo do agente que seleciona um próximo card MUST verificar primeiro os cards atribuídos ao usuário atual dentro do projeto e tenant correntes. Um card elegível MUST ser folha, estar em uma coluna iniciável (`NOT_STARTED`) e não estar concluído, arquivado ou bloqueado. Havendo candidatos próprios, o agente MUST selecionar entre eles antes de considerar cards sem atribuição. A atribuição existente MUST ser preservada.

#### Scenario: Existe card elegível atribuído ao usuário atual
- **WHEN** o agente procura um próximo card e há ao menos um card folha iniciável atribuído à identidade atual
- **THEN** o agente escolhe um dos cards atribuídos antes de qualquer card sem atribuição

#### Scenario: Não há card elegível atribuído ao usuário atual
- **WHEN** o agente procura um próximo card e nenhum card atribuído à identidade atual é elegível
- **THEN** o agente mantém o fluxo de seleção atual para cards disponíveis sem responsável

#### Scenario: Card atribuído a outra pessoa
- **WHEN** um card iniciável está atribuído a outro usuário
- **THEN** o agente não o seleciona para claim nem altera sua atribuição

#### Scenario: Card não elegível
- **WHEN** um card atribuído ao usuário atual está bloqueado, concluído, arquivado, não é folha ou está numa coluna não iniciável
- **THEN** o agente o ignora na seleção prioritária

#### Scenario: A atribuição muda durante a seleção
- **WHEN** a atribuição ou disponibilidade do card muda antes do claim
- **THEN** o agente respeita o resultado do claim e consulta novamente os candidatos sem sobrescrever a atribuição atual

### Requirement: Respeitar o escopo de projeto e tenant
A verificação de atribuições MUST limitar consultas ao projeto e tenant da sessão autenticada, sem expor nem selecionar cards de outro escopo.

#### Scenario: Existem cards atribuídos em outro projeto ou tenant
- **WHEN** o agente procura cards atribuídos no projeto corrente
- **THEN** apenas cards pertencentes ao projeto e tenant correntes participam da seleção
