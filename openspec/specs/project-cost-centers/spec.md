## ADDED Requirements

### Requirement: CRUD de centros de custo por projeto
O sistema SHALL permitir que administradores do projeto cadastrem, editem e excluam centros de custo. Cada centro de custo possui código (VARCHAR(20), único por projeto) e descrição (VARCHAR(200)).

#### Scenario: Criar centro de custo com sucesso
- **WHEN** administrador envia código e descrição válidos para `POST /projects/:id/cost-centers`
- **THEN** sistema persiste o novo centro de custo vinculado ao projeto e ao tenant, retornando o registro criado com 201

#### Scenario: Código duplicado dentro do mesmo projeto
- **WHEN** administrador tenta criar centro de custo com código já existente no projeto
- **THEN** sistema retorna erro 409 com mensagem "Código de centro de custo já existe neste projeto"

#### Scenario: Editar centro de custo
- **WHEN** administrador envia PATCH com novo código ou descrição para `/projects/:id/cost-centers/:ccId`
- **THEN** sistema atualiza o registro e retorna 200 com os dados atualizados

#### Scenario: Excluir centro de custo sem tasks associadas
- **WHEN** administrador exclui centro de custo que não está associado a nenhuma task
- **THEN** sistema remove o registro e retorna 204

#### Scenario: Excluir centro de custo com tasks associadas
- **WHEN** administrador tenta excluir centro de custo que está associado a uma ou mais tasks
- **THEN** sistema retorna erro 409 com contagem de tasks associadas e instrução para reatribuí-las antes

#### Scenario: Listar centros de custo do projeto
- **WHEN** membro faz `GET /projects/:id/cost-centers`
- **THEN** sistema retorna lista ordenada por `sort_order` com id, code, description de cada centro

---

### Requirement: Exibição e gestão na tela de Settings do projeto
O sistema SHALL exibir uma seção "Centros de Custo" nas configurações do projeto, com formulário de criação e lista editável.

#### Scenario: Admin vê seção de Centros de Custo
- **WHEN** administrador acessa as configurações do projeto
- **THEN** seção "Centros de Custo" é exibida com a lista atual e campos para criar novo (Código + Descrição + botão Adicionar)

#### Scenario: VIEWER e MEMBER veem lista somente leitura
- **WHEN** usuário com papel VIEWER ou MEMBER acessa as configurações do projeto
- **THEN** seção exibe os centros de custo em modo somente leitura, sem botões de criar/editar/excluir

---

### Requirement: Associação automática de centro de custo na criação de tasks
O sistema SHALL, ao criar qualquer item (TASK, BUG, STORY — exceto EPIC), verificar se o projeto possui centros de custo cadastrados e, em caso positivo, atribuir automaticamente o de menor `sort_order` ao novo item.

#### Scenario: Projeto com centros de custo — auto-preenchimento
- **WHEN** membro cria uma nova task em projeto que possui pelo menos um centro de custo
- **THEN** `cost_center_id` do novo item é automaticamente preenchido com o id do primeiro centro de custo (menor `sort_order`) do projeto

#### Scenario: Projeto sem centros de custo — campo nulo
- **WHEN** membro cria task em projeto sem centros de custo cadastrados
- **THEN** `cost_center_id` do novo item fica null e nenhum campo de centro de custo é exibido na modal

#### Scenario: Criação via MCP também aplica auto-preenchimento
- **WHEN** agente de IA cria item via endpoint MCP sem informar `cost_center_id`
- **THEN** backend aplica a mesma regra de auto-preenchimento server-side

---

### Requirement: Campo de centro de custo na modal de task/subtask/bug
O sistema SHALL exibir um campo combo (select) de centro de custo nas modais de criação e edição de tasks, subtasks e bugs, quando o projeto possuir centros de custo cadastrados.

#### Scenario: Combo exibido somente quando projeto tem centros de custo
- **WHEN** usuário abre modal de criação ou edição de task em projeto com centros de custo
- **THEN** combo "Centro de Custo" é exibido com todas as opções do projeto; o valor atual (ou o primeiro, na criação) aparece selecionado

#### Scenario: Combo oculto quando projeto não tem centros de custo
- **WHEN** usuário abre modal de criação ou edição de task em projeto sem centros de custo
- **THEN** campo "Centro de Custo" não é renderizado na modal

#### Scenario: Alterar centro de custo via modal
- **WHEN** membro seleciona opção diferente no combo e salva
- **THEN** sistema persiste o novo `cost_center_id` e atualiza o registro imediatamente

#### Scenario: Campo não obrigatório — salvar sem centro de custo
- **WHEN** usuário limpa a seleção do combo (escolhe opção "— Nenhum —") e salva
- **THEN** sistema persiste `cost_center_id = null` sem retornar erro de validação
