## Purpose

Definir os requisitos da capacidade unified item model.
## Requirements
### Requirement: Tabela `items` como entidade unificada
O sistema SHALL manter todos os itens de trabalho (Épicos, Histórias, Tasks e Bugs) em uma única tabela `items` com `type` discriminante e `parentId` auto-referenciado. As tabelas `epics` e `stories` SHALL ser removidas.

#### Scenario: Criar item do tipo EPIC
- **WHEN** membro cria um épico via `POST /projects/:id/items` com `type = EPIC` e `moduleId` válido
- **THEN** sistema registra o item com `parentId = null` e `moduleId` preenchido

#### Scenario: Criar item do tipo STORY
- **WHEN** membro cria uma história via `POST /projects/:id/items` com `type = STORY` e `parentId` de um EPIC válido
- **THEN** sistema valida que o `parentId` aponta para um item com `type = EPIC` no mesmo projeto e registra a história

#### Scenario: Criar item do tipo TASK ou BUG
- **WHEN** membro cria um card via `POST /projects/:id/items` com `type IN (TASK, BUG)` e `parentId` de STORY, TASK ou BUG
- **THEN** sistema registra o item com `columnId` e atualiza o `ancestryPath`

#### Scenario: Hierarquia inválida rejeitada
- **WHEN** membro tenta criar uma STORY com `parentId` apontando para um item com `type = TASK`
- **THEN** sistema retorna erro 400 com mensagem descrevendo a hierarquia válida esperada

---

### Requirement: Validação de hierarquia por tipo na camada de serviço
O sistema SHALL validar que a hierarquia formada por `parentId` respeita as seguintes regras: EPIC tem `parentId = null`; STORY é filha de EPIC; TASK e BUG são filhos de STORY, TASK ou BUG.

#### Scenario: Tentativa de criar EPIC com parentId
- **WHEN** request inclui `type = EPIC` e `parentId` não nulo
- **THEN** sistema retorna erro 400

#### Scenario: Tentativa de criar STORY filha de outra STORY
- **WHEN** request inclui `type = STORY` e `parentId` de um item com `type = STORY`
- **THEN** sistema retorna erro 400

---

### Requirement: Interface `Card` como contrato Adapter
O sistema SHALL expor uma interface TypeScript `Card` em `packages/types/src/card.ts`. Toda lógica de renderização de card no frontend SHALL consumir `Card`, nunca o tipo raw do banco. A interface SHALL incluir o campo `sequenceCode: string | null`.

#### Scenario: Item de qualquer tipo convertido para Card
- **WHEN** frontend recebe um item da API
- **THEN** a função `toCard(item)` converte o item para a interface `Card` com campos: `id`, `type`, `title`, `columnId`, `priority`, `points`, `assigneeId`, `tags`, `isLeaf`, `ancestryPath`, `parentId`, `sequenceCode`

#### Scenario: KanbanCard renderizado a partir de Card
- **WHEN** `KanbanCard` recebe uma prop do tipo `Card`
- **THEN** renderiza badge, badge de tipo, prioridade e demais campos sem precisar conhecer o tipo específico da entidade de origem

#### Scenario: Card sem sequenceCode
- **WHEN** item não possui `sequenceCode` (null)
- **THEN** `toCard()` mapeia `sequenceCode: null` e o card renderiza normalmente sem o código visual

### Requirement: Rotas CRUD unificadas em `/projects/:id/items`
O sistema SHALL expor as rotas `GET`, `POST`, `PATCH` e `DELETE` em `/projects/:id/items` para gerenciar todos os tipos de item. Filtros por `type`, `parentId` e `columnId` cobrem todos os casos de uso anteriores das rotas `/epics`, `/stories` e `/tasks`.

#### Scenario: Listar items do board (TASK e BUG folhas)
- **WHEN** frontend faz `GET /projects/:id/items?type=TASK,BUG&leaf=true`
- **THEN** API retorna apenas items sem filhos com `type IN (TASK, BUG)` do projeto, respeitando tenant

#### Scenario: Listar EPICs para swimlanes
- **WHEN** frontend faz `GET /projects/:id/items?type=EPIC`
- **THEN** API retorna os épicos do projeto ordenados por `position`

#### Scenario: Filtro por módulo via EPIC
- **WHEN** frontend inclui `moduleId` no query param
- **THEN** API retorna apenas items cujo EPIC ancestral tem aquele `moduleId`

#### Scenario: Rotas antigas removidas
- **WHEN** qualquer cliente faz `GET /projects/:id/tasks` ou `GET /projects/:id/epics`
- **THEN** API retorna 404

---

### Requirement: Seed com dados de exemplo para todos os tipos
O sistema SHALL incluir script de seed que dropa e recria o banco populando a tabela `items` com exemplos representativos de EPIC, STORY, TASK, BUG e subtasks. O seed SHALL construir `ancestryPath` corretamente para cada item.

#### Scenario: Seed executado com sucesso
- **WHEN** desenvolvedor executa `bun run seed`
- **THEN** banco é recriado com ao menos: 1 projeto, 2 módulos, 2 EPICs, 4 STORYs, 8 TASKs, 2 BUGs, 2 subtasks de TASK

#### Scenario: ancestryPath correto no seed
- **WHEN** seed é executado
- **THEN** cada item tem `ancestryPath` como JSON array com `{ id, title, type }` de todos os ancestrais até a raiz

### Requirement: Hierarquia de items reforçada no banco
Além da validação na camada de serviço, `items.parent_id` SHALL possuir auto-chave estrangeira composta `(tenant_id, parent_id) → items(tenant_id, id)`, garantindo que o pai exista e pertença ao mesmo tenant. `projects.manager_user_id` e `projects.simple_story_id` SHALL possuir chaves estrangeiras compostas equivalentes.

#### Scenario: Hierarquia inválida barrada pelo banco
- **WHEN** uma gravação tenta definir pai fora do tenant, pai inexistente, gerente de outro tenant ou story fixa de outro tenant
- **THEN** o banco rejeita a operação e mantém a árvore consistente

#### Scenario: Regras de tipo continuam na aplicação
- **WHEN** um item é criado respeitando a hierarquia de tipos (STORY filha de EPIC, TASK/BUG filha de STORY/TASK/BUG)
- **THEN** a operação é aceita e persiste com o vínculo correto

#### Scenario: Exclusão de ancestral preserva integridade
- **WHEN** um item com filhos é excluído pelo fluxo de exclusão em cascata
- **THEN** os descendentes são removidos na mesma operação e nenhuma violação de chave estrangeira permanece

### Requirement: Atualização atômica de item e tags
`POST` e `PATCH /projects/:projectId/items` SHALL aceitar `tagIds` opcional e persistir o item e seus vínculos de tags na mesma transação; se qualquer parte falhar, nenhuma alteração SHALL ser confirmada. A resposta SHALL incluir o item com as tags resultantes e SHALL emitir um único broadcast de atualização.

#### Scenario: PATCH com tagIds grava item e tags atomicamente
- **WHEN** membro faz `PATCH /projects/:projectId/items/:itemId` com campos e `tagIds`
- **THEN** o item e os vínculos de tags são gravados na mesma transação e a resposta traz o item com as tags resultantes

#### Scenario: Falha em tag inválida não grava o item
- **WHEN** o `tagIds` informado contém uma tag inexistente ou de outro projeto
- **THEN** a operação é rejeitada e nenhuma alteração de campos é confirmada

#### Scenario: POST com tagIds cria o item já com tags
- **WHEN** membro cria um item com `tagIds`
- **THEN** o item é criado com os vínculos de tags na mesma operação

### Requirement: Versão de edição exposta para detecção de conflito
Os payloads de item SHALL expor `updatedAt`. O `PATCH /projects/:projectId/items/:itemId` SHALL aceitar `expectedUpdatedAt`; quando informado e diferente do valor atual do registro, a API SHALL responder HTTP 409 com código `CONFLICT` e o estado atual do item, sem aplicar a alteração.

#### Scenario: Update condicional com versão atual aplica
- **WHEN** o `PATCH` informa `expectedUpdatedAt` igual ao `updatedAt` atual do item
- **THEN** a alteração é aplicada normalmente

#### Scenario: Update condicional com versão defasada retorna conflito
- **WHEN** o `PATCH` informa `expectedUpdatedAt` diferente do `updatedAt` atual
- **THEN** a API responde 409 `CONFLICT` com o item atual e não altera o registro

#### Scenario: Sem versão mantém o comportamento atual
- **WHEN** o `PATCH` não informa `expectedUpdatedAt`
- **THEN** a alteração é aplicada como hoje, sem verificação de conflito

