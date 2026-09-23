## ADDED Requirements

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
