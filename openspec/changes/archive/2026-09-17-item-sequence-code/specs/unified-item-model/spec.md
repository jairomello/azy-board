## MODIFIED Requirements

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
