# Spec Delta

## MODIFIED Requirements

### Requirement: Drag-and-drop de cards entre colunas
O sistema SHALL persistir a mudança de coluna de um card ao soltar no destino via `PATCH /projects/:id/items/:id/move`. A posição vertical escolhida na coluna de destino SHALL ser persistida na mesma operação, via `PATCH /projects/:id/items/reorder` com a ordem dos cards móveis da coluna (sem filhos e não arquivados) já com o card movido na posição da vaga; sem uma âncora de card na coluna, o card entra no fim.

#### Scenario: Card fixado na nova coluna após drop
- **WHEN** usuário arrasta card de uma coluna e solta em outra
- **THEN** card aparece na coluna destino e o status base da coluna é aplicado via `PATCH /items/:id/move`

#### Scenario: Posição escolhida na coluna de destino
- **WHEN** usuário move um card para outra coluna soltando entre dois cards
- **THEN** o sistema envia a ordem da coluna de destino com o card na posição da vaga via `PATCH /items/reorder` e o card permanece nessa posição após soltar

#### Scenario: Destino sem cards
- **WHEN** usuário move um card para uma coluna vazia
- **THEN** a ordem enviada contém somente o card movido e ele ocupa a primeira posição

#### Scenario: Rollback em caso de erro da API
- **WHEN** chamada à API de move ou de reorder falha após o drop
- **THEN** card retorna visualmente para a coluna e a posição originais, as posições dos demais cards da coluna de destino são restauradas e mensagem de erro é exibida
