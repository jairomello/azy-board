# Spec Delta

## ADDED Requirements

### Requirement: Listagem agregada de anexos por projeto

O sistema SHALL disponibilizar uma leitura somente leitura que retorna todos os
anexos vinculados a qualquer card de um projeto, sem filtro por item. A leitura
SHALL ser escopada por tenant e projeto, exigir membership no projeto e expor,
para cada anexo, o card de origem e seus metadados, mantendo a leitura
preservada mesmo quando a capacidade de anexos está desabilitada.

#### Scenario: Listar todos os anexos do projeto

- **WHEN** um usuário com acesso de leitura requisita os anexos agregados de um projeto
- **THEN** o sistema retorna os anexos dos cards do projeto no tenant, cada um com o card de origem

#### Scenario: Anexos desabilitados para o tenant

- **WHEN** a capacidade de anexos está desabilitada para o tenant e o usuário abre a modal do projeto
- **THEN** a aba "Todos os anexos" não é exibida, mantendo-se apenas links e demais informações
- **AND** a leitura agregada de anexos permanece disponível a usuários autorizados, consistente com a leitura de conteúdo do item

#### Scenario: Projeto sem anexos

- **WHEN** o projeto não possui anexos em nenhum card
- **THEN** o sistema retorna uma lista vazia

#### Scenario: Isolamento entre projetos e tenants

- **WHEN** um usuário sem membership requisita os anexos agregados de um projeto não autorizado
- **THEN** o sistema rejeita a operação sem revelar anexos de outro tenant, projeto ou card

#### Scenario: Download a partir da lista agregada

- **WHEN** o usuário aciona o download de um anexo a partir da lista agregada do projeto
- **THEN** o sistema entrega o arquivo pela rota autenticada, validando membership e associação ao card de origem
