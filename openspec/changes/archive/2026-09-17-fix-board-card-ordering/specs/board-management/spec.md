## MODIFIED Requirements

### Requirement: Persistência de posição vertical de cards na coluna
O sistema SHALL persistir a posição (ordem) dos cards dentro de uma coluna ao realizar drag-and-drop vertical via `PATCH /projects/:id/items/reorder`. Ao resolver o drop, SHALL aceitar o ID do card alvo ou um marcador de coluna compatível com o Board, SHALL enviar a ordem completa dos cards persistíveis da coluna e SHALL excluir cards virtuais ou itens não persistíveis.

#### Scenario: Reordenar cards na mesma coluna
- **WHEN** usuário arrasta um card folha para outra posição na mesma coluna e solta sobre um card alvo válido
- **THEN** card permanece na nova posição após soltar
- **AND** sistema chama `PATCH /projects/:id/items/reorder` com `{ columnId, order: string[] }` contendo todos os cards persistíveis da coluna na nova ordem

#### Scenario: Soltar em marcador de coluna
- **WHEN** usuário arrasta um card folha e o evento de drop informa um marcador `:drop:` ou `:col:` associado à coluna
- **THEN** sistema resolve a coluna sem confundir o marcador com um card alvo
- **AND** não envia um reorder vertical sem uma âncora de card válida

#### Scenario: Cards virtuais não são persistidos
- **WHEN** a coluna contém referências virtuais de histórias ou itens que não existem como cards persistíveis
- **THEN** o payload de reorder omite essas referências e contém somente IDs persistíveis

#### Scenario: Rollback de reordenação em erro
- **WHEN** chamada de API de reorder falha
- **THEN** cards voltam à ordem anterior (rollback visual)
- **AND** mensagem de erro é exibida ao usuário
