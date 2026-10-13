# Spec Delta

## ADDED Requirements

### Requirement: Pré-visualização de exclusão de projeto

A ferramenta `delete_project` SHALL aceitar `dryRun` como booleano opcional, com descrição no schema exposto, e SHALL encaminhá-lo ao `DELETE /projects/:id`. Com `dryRun` verdadeiro, a chamada SHALL devolver a pré-visualização com as contagens dos registros filhos do projeto e NÃO SHALL excluir nada. Valor não booleano SHALL ser rejeitado com erro acionável que cita o campo. Sem o campo, a exclusão SHALL manter o comportamento atual.

#### Scenario: Pré-visualização não exclui

- **WHEN** o agente chama `delete_project` com `dryRun: true` em um projeto existente
- **THEN** a resposta traz a pré-visualização com as contagens dos registros filhos do projeto e o projeto permanece intacto

#### Scenario: Exclusão real preservada

- **WHEN** o agente chama `delete_project` sem `dryRun` (ou com `dryRun: false`) em um projeto que pode excluir
- **THEN** o projeto e os registros dependentes são excluídos como hoje, e a lista de projetos deixa de exibi-lo

#### Scenario: Valor não booleano é rejeitado

- **WHEN** o agente envia `dryRun` com um valor que não é boolean nem `true`/`false` textual
- **THEN** a chamada falha com erro de validação acionável apontando o campo, sem excluir nem pré-visualizar

#### Scenario: Catálogo exposto declara o campo

- **WHEN** um cliente lista as ferramentas do MCP
- **THEN** `delete_project` expõe `dryRun` como campo opcional com descrição de uso, mantendo `projectId` como único obrigatório

#### Scenario: Exclusão continua exigindo permissão

- **WHEN** o agente sem papel ADMIN no projeto tenta `delete_project` (com ou sem `dryRun`)
- **THEN** a operação é recusada e nenhum registro é alterado
