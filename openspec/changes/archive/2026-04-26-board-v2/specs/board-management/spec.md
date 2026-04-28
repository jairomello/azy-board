## MODIFIED Requirements

### Requirement: Toggle "Stories como cards" no board

**MODIFIED** — Adicionar novo toggle ao toolbar do board.

O sistema SHALL exibir um toggle "Mostrar histórias" no toolbar, ao lado do toggle de subtasks.

#### Scenario: Toggle desativado (padrão)
- **WHEN** o toggle "Mostrar histórias" está desativado
- **THEN** apenas tasks (tipo TASK e BUG) são exibidas como cards no board; histórias permanecem como agrupadores de swimlane

#### Scenario: Toggle ativado
- **WHEN** o toggle "Mostrar histórias" está ativado
- **THEN** histórias da entidade `stories` são exibidas como cards virtuais na primeira coluna do board, com badge tipo `Story` e sem possibilidade de arrastar

#### Scenario: Clicar em card de história no board
- **WHEN** o toggle está ativado e o usuário clica em um card de história
- **THEN** a `StoryModal` é aberta em modo de edição

## ADDED Requirements

### Requirement: Persistência de posição vertical de cards na coluna
O sistema SHALL persistir a posição (ordem) dos cards dentro de uma coluna ao realizar drag-and-drop vertical.

#### Scenario: Reordenar cards na mesma coluna
- **WHEN** o usuário arrasta um card para outra posição na mesma coluna e solta
- **THEN** o card permanece na nova posição após o mouse ser solto
- **AND** sistema chama `PATCH /projects/:id/tasks/reorder` com `{ columnId, order: string[] }` para persistir a ordem

#### Scenario: Rollback de reordenação em erro
- **WHEN** a chamada de API de reorder falha
- **THEN** os cards voltam à ordem anterior (rollback visual)
