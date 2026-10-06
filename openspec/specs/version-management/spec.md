## Purpose

Definir os requisitos da capacidade version management.
## Requirements
### Requirement: CRUD de versões de projeto em Settings
O sistema SHALL permitir que administradores criem, editem, visualizem e excluam versões de um projeto na seção "Versões" da tela de configurações. Campos de uma versão: nome (obrigatório), data de lançamento (opcional), descrição (opcional), situação (`PLANNED` | `IN_DEV` | `RELEASED` | `CANCELLED`).

#### Scenario: Criar nova versão
- **WHEN** admin preenche o formulário de nova versão com nome obrigatório e confirma
- **THEN** versão é criada via `POST /projects/:id/versions` e aparece na lista com situação "Planejada"

#### Scenario: Editar versão existente
- **WHEN** admin clica em "Editar" em uma versão
- **THEN** `VersionDetailModal` abre em modo edição com os campos preenchidos e a lista de itens vinculados; ao salvar, chama `PATCH /projects/:id/versions/:versionId`

#### Scenario: Visualizar versão (somente leitura)
- **WHEN** usuário clica em "Ver" em uma versão
- **THEN** `VersionDetailModal` abre em modo leitura com campos somente leitura e lista de itens vinculados

#### Scenario: Excluir versão
- **WHEN** admin clica em "Excluir" e confirma o diálogo
- **THEN** versão é removida via `DELETE /projects/:id/versions/:versionId`; itens vinculados têm `version_id` definido como null (sem cascata de exclusão)

#### Scenario: VIEWER não pode criar ou editar versões
- **WHEN** usuário com papel VIEWER acessa Settings
- **THEN** botões de criar/editar/excluir versão não são exibidos (ou retornam 403 na API)

---

### Requirement: Modal de detalhe de versão com lista de itens
O sistema SHALL exibir uma `VersionDetailModal` que combina o formulário de edição da versão com a lista paginada de itens (épicos, histórias, tasks, bugs) vinculados a ela.

#### Scenario: Lista de itens vinculados na modal
- **WHEN** `VersionDetailModal` abre para uma versão que possui itens vinculados
- **THEN** lista exibe cada item com: título, tipo (ícone), status (badge), responsável (avatar)

#### Scenario: Versão sem itens vinculados
- **WHEN** `VersionDetailModal` abre para uma versão sem itens
- **THEN** exibe mensagem "Nenhum item vinculado a esta versão"

#### Scenario: Paginação da lista de itens
- **WHEN** versão possui mais de 20 itens vinculados
- **THEN** lista exibe 20 por página com botão "Carregar mais"

---

### Requirement: Campo versão opcional nos itens
O sistema SHALL permitir associar qualquer item (EPIC, STORY, TASK, BUG) a uma versão do projeto, de forma opcional, nas respectivas modais de edição.

#### Scenario: Associar versão a um item
- **WHEN** usuário seleciona uma versão no campo "Versão" da modal do item e salva
- **THEN** `version_id` é persistido no item via API e o campo exibe o nome da versão selecionada

#### Scenario: Remover versão de um item
- **WHEN** usuário seleciona "Sem versão" no campo "Versão" e salva
- **THEN** `version_id` é definido como null no item

#### Scenario: Campo versão ausente para projetos sem versões
- **WHEN** projeto não possui nenhuma versão cadastrada
- **THEN** campo "Versão" não é exibido nas modais de edição de itens

---

### Requirement: API de versões de projeto
O sistema SHALL expor endpoints REST para gerenciar versões, respeitando tenant e RBAC.

#### Scenario: Listar versões do projeto
- **WHEN** `GET /projects/:id/versions` é chamado por membro autenticado
- **THEN** retorna array de versões ordenado por `position`, com campos id, name, releaseDate, description, status

#### Scenario: Criar versão
- **WHEN** `POST /projects/:id/versions` com `{ name, releaseDate?, description?, status? }` é chamado por ADMIN
- **THEN** versão é criada com `tenant_id` do middleware e retorna 201 // [TENANT]

#### Scenario: Atualizar versão
- **WHEN** `PATCH /projects/:id/versions/:versionId` é chamado por ADMIN
- **THEN** campos fornecidos são atualizados; `version_id` não pode ser alterado

#### Scenario: Excluir versão
- **WHEN** `DELETE /projects/:id/versions/:versionId` é chamado por ADMIN
- **THEN** versão é removida; todos os itens com `version_id` igual ficam com `version_id = null`

#### Scenario: Listar itens de uma versão
- **WHEN** `GET /projects/:id/versions/:versionId/items?page&limit` é chamado
- **THEN** retorna lista paginada de itens com `version_id` igual ao da versão // [TENANT]

#### Scenario: VIEWER não pode criar/editar/excluir versões
- **WHEN** usuário VIEWER chama POST, PATCH ou DELETE em versões
- **THEN** API retorna 403

### Requirement: Vínculo automático à versão vigente na criação

Na criação de um card (TASK/BUG) **sem `versionId` explícito**, o sistema SHALL vinculá-lo automaticamente à **versão vigente** do projeto: a versão com `status != CANCELLED`, `releaseDate` não nula e **futura mais próxima** da data atual (menor `releaseDate >= hoje`); havendo empate, SHALL escolher a de menor `createdAt`. `versionId` explícito (ID ou `null`) SHALL ter precedência. O vínculo SHALL valer para criação individual e em lote, respeitar projeto/tenant e MUST NOT criar vínculo duplicado.

#### Scenario: Criação de task com versão vigente

- **WHEN** card TASK/BUG é criado sem informar versão e existe versão não cancelada com a próxima `releaseDate` futura
- **THEN** o card é vinculado automaticamente a essa versão

#### Scenario: Versão sem data não é candidata

- **WHEN** a única versão não cancelada não possui `releaseDate`
- **THEN** o card é criado sem vínculo automático de versão

#### Scenario: Versão cancelada não é candidata

- **WHEN** a versão com a próxima `releaseDate` está `CANCELLED`
- **THEN** ela é ignorada e o sistema considera a próxima candidata válida

#### Scenario: Empate de data entre versões

- **WHEN** mais de uma versão candidata tem a mesma `releaseDate`
- **THEN** o sistema vincula o card à de menor `createdAt`

#### Scenario: Versão explícita tem precedência

- **WHEN** card é criado informando `versionId` de uma versão existente
- **THEN** o vínculo automático não é aplicado e o card usa a versão informada

#### Scenario: Criação explícita sem versão

- **WHEN** card é criado informando `versionId: null`
- **THEN** o card é criado sem vínculo de versão, mesmo que exista versão vigente

#### Scenario: Criação em lote com versão vigente

- **WHEN** operações de criação de TASK/BUG em lote omitem a versão e existe versão vigente
- **THEN** cada card criado é vinculado à versão vigente, sem vínculo duplicado

#### Scenario: Sem versão vigente

- **WHEN** card TASK/BUG é criado sem informar versão e não há versão vigente
- **THEN** o card é criado normalmente sem vínculo de versão

### Requirement: Edição de versão pela conversa com paridade à tela

O sistema SHALL permitir que o Azy Agent edite `name`, `releaseDate`, `description` e `status` de uma versão existente pela conversa, com a mesma validação e permissão da seção "Versões" da tela de configurações. O agente SHALL poder definir um valor (`SET`) e limpar um campo opcional (`CLEAR`), este último restrito a `releaseDate` e `description`, produzindo o mesmo efeito de “Sem versão”/descrição vazia. `status` SHALL ser restrito a `PLANNED`, `IN_DEV`, `RELEASED` e `CANCELLED`. A edição NÃO SHALL alterar o vínculo de itens à versão nem remover a versão.

#### Scenario: Renomear versão

- **WHEN** o usuário pede para renomear uma versão e confirma a prévia
- **THEN** apenas o nome da versão é alterado

#### Scenario: Marcar versão como liberada e registrar data

- **WHEN** o usuário pede para marcar uma versão como liberada e informar a data
- **THEN** `status` passa a `RELEASED` e `releaseDate` é persistida, com a mudança refletida na tela

#### Scenario: Limpar data ou descrição

- **WHEN** o usuário pede para remover a data de lançamento ou a descrição de uma versão
- **THEN** o campo correspondente é definido como vazio, sem alterar os demais campos nem o vínculo de itens

#### Scenario: Status inválido é rejeitado

- **WHEN** a edição informa um `status` fora do enum permitido
- **THEN** o sistema rejeita com erro acionável e a versão permanece inalterada

### Requirement: Criação de versão com campos completos pela conversa

O sistema SHALL permitir criar uma versão pela conversa informando, além do nome, `releaseDate`, `description` e `status`, com paridade à tela de configurações. A criação informando apenas o nome SHALL continuar válida.

#### Scenario: Criar versão com data e situação

- **WHEN** o usuário pede para criar a versão v1.0.0 com data de lançamento e situação `IN_DEV`
- **THEN** a versão é criada com nome, data e situação informados

#### Scenario: Criar versão só com nome

- **WHEN** o usuário pede para criar uma versão informando apenas o nome
- **THEN** a versão é criada com a situação padrão, como hoje

