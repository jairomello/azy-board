# Spec Delta

## ADDED Requirements

### Requirement: Opções de visibilidade de níveis nas ferramentas de projeto

As ferramentas `create_project`, `update_project` e `create_project_structure` SHALL aceitar `hideModules` e `hideEpics` como booleanos opcionais (anuláveis no modo estrito), cada um com descrição no schema exposto. Os valores SHALL seguir a semântica do REST: valem só em `HIERARCHICAL`, ficam `false` em `SIMPLE` e, em `update_project`, ligar a opção SHALL recolher a hierarquia. Valor não boolean SHALL ser rejeitado com erro acionável, e campos de topo não declarados SHALL seguir rejeitados.

#### Scenario: Criação com as opções

- **WHEN** o agente chama `create_project` com `hideModules` e/ou `hideEpics` em um projeto `HIERARCHICAL`
- **THEN** o projeto é criado com os valores informados e `get_project` devolve os dois campos

#### Scenario: Criação sem as opções

- **WHEN** o agente chama `create_project` sem informar `hideModules` nem `hideEpics`
- **THEN** o projeto é criado com ambos em `false`, sem exigir que o agente pergunte pelos campos

#### Scenario: Projeto simples nunca oculta níveis

- **WHEN** o agente chama `create_project` com `boardMode = SIMPLE` e alguma das opções em `true`
- **THEN** o projeto é persistido com `hideModules` e `hideEpics` em `false`

#### Scenario: Ligar a opção recolhe a hierarquia

- **WHEN** o agente chama `update_project` ligando `hideModules` ou `hideEpics` em um projeto `HIERARCHICAL`
- **THEN** a hierarquia é recolhida como no REST, com o patch aplicado na mesma operação e os demais campos do projeto preservados

#### Scenario: Reenvio idempotente da edição

- **WHEN** a mesma chamada de `update_project` com a opção já ligada é repetida
- **THEN** nenhum recolhimento adicional ocorre e o resultado observável permanece o mesmo

#### Scenario: Valor não booleano é rejeitado

- **WHEN** o agente envia `hideModules` com um valor que não é boolean nem `true`/`false` textual
- **THEN** a chamada falha com erro de validação acionável, apontando o campo, e nenhum projeto é alterado

#### Scenario: Campo não declarado continua rejeitado

- **WHEN** o agente envia em `create_project` um campo de topo que não pertence ao catálogo
- **THEN** a chamada é rejeitada, preservando a política de campos declarados

#### Scenario: Catálogo exposto documenta as opções

- **WHEN** um cliente lista as ferramentas do MCP
- **THEN** `create_project`, `update_project` e `create_project_structure` expõem `hideModules` e `hideEpics` como campos opcionais, cada um com descrição de uso

#### Scenario: Criação de estrutura propaga as opções

- **WHEN** o agente chama `create_project_structure` informando `hideModules` e/ou `hideEpics`
- **THEN** o projeto criado pela ferramenta nasce com os valores informados, junto da estrutura solicitada
