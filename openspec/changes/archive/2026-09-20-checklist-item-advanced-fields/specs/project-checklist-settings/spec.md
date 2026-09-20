## ADDED Requirements

### Requirement: Opção por projeto para checklists detalhados

O sistema SHALL oferecer, por projeto, a opção `advancedChecklists` (coluna `advanced_checklists`), booleana e com padrão `false`, que habilita campos avançados nos itens de checklist. A alteração SHALL ser permitida apenas a ADMIN do projeto por `PATCH /projects/:id`, e o valor SHALL ser persistido, devolvido nos payloads de projeto/board e auditável. Desligar a opção SHALL NOT apagar os valores avançados já gravados: eles permanecem no banco e voltam a ser expostos se a opção for reativada.

#### Scenario: Projeto novo começa no modo simples
- **WHEN** um projeto é criado sem informar `advancedChecklists`
- **THEN** o sistema persiste `advancedChecklists = false` e o devolve assim na resposta

#### Scenario: Administrador habilita checklists detalhados
- **WHEN** um ADMIN envia `PATCH /projects/:id` com `{ "advancedChecklists": true }`
- **THEN** o sistema persiste a opção e passa a expor os campos avançados nos itens de checklist do projeto

#### Scenario: Usuário sem permissão tenta habilitar
- **WHEN** MEMBER ou VIEWER envia `PATCH /projects/:id` com `advancedChecklists`
- **THEN** o sistema retorna HTTP 403 e não altera a opção

#### Scenario: Desligar preserva os dados avançados
- **WHEN** um ADMIN desliga `advancedChecklists` em um projeto que já possui itens com `dueDate`, `assigneeId` ou `description`
- **THEN** o sistema passa a operar no modo simples sem apagar os valores gravados
- **AND** ao reativar a opção os valores voltam a ser expostos

#### Scenario: Visibilidade da opção no board
- **WHEN** o cliente carrega `GET /projects/:id` ou `GET /projects/:id/board`
- **THEN** a resposta inclui `advancedChecklists` com o valor vigente do projeto

### Requirement: Gate de campos avançados conforme o modo do projeto

No projeto com `advancedChecklists = false` (modo simples), o sistema SHALL expor cada item de checklist apenas com `{ id, text, checked, position }` e SHALL rejeitar escrita de `dueDate`, `assigneeId` ou `description` com erro de validação não retentável. No projeto com `advancedChecklists = true`, o sistema SHALL aceitar e retornar esses campos como opcionais.

#### Scenario: Escrita de campo avançado com a opção desligada
- **WHEN** usuário autenticado envia `POST .../items` ou `PATCH .../items/:checklistItemId` com `dueDate`, `assigneeId` ou `description` em projeto com `advancedChecklists = false`
- **THEN** o sistema retorna erro de validação indicando que a opção de checklists detalhados está desabilitada
- **AND** o item não é alterado

#### Scenario: Leitura no modo simples
- **WHEN** cliente carrega o detalhe do card ou o board de um projeto com `advancedChecklists = false`
- **THEN** os itens de checklist não incluem `dueDate`, `assigneeId`, `assignee` nem `description`

#### Scenario: Escrita de campo avançado com a opção ligada
- **WHEN** usuário autenticado envia `dueDate`, `assigneeId` ou `description` em projeto com `advancedChecklists = true`
- **THEN** o sistema persiste apenas os campos informados e retorna o item atualizado

### Requirement: Seção de checklists nas configurações do projeto

O sistema SHALL exibir, na tela de configurações do projeto, uma seção acessível por ADMIN com o controle "Checklists detalhados", desligado por padrão, acompanhado de texto de apoio que descreva data, responsável e descrição. O controle SHALL ser acessível por teclado e SHALL ter os textos traduzidos em pt-BR, en e es.

#### Scenario: Seção visível para administrador
- **WHEN** um ADMIN abre as configurações do projeto
- **THEN** a seção de checklists aparece em accordion com o controle desligado quando o projeto está no modo simples

#### Scenario: Estado reflete o projeto
- **WHEN** o projeto já possui `advancedChecklists = true`
- **THEN** o controle aparece ligado ao abrir as configurações

#### Scenario: Mensagem de erro ao salvar
- **WHEN** o salvamento da opção falha
- **THEN** o sistema mantém o valor anterior e exibe mensagem de erro traduzida, sem alterar a apresentação do board
