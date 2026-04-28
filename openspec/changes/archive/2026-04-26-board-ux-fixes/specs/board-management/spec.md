## MODIFIED Requirements

### Requirement: Reordenação de colunas por drag-and-drop
O sistema SHALL permitir reordenar as colunas do board arrastando o header da coluna para a nova posição, persistindo a ordem via API.

#### Scenario: Reordenar coluna arrastando o header
- **WHEN** usuário arrasta o header de uma coluna para outra posição no board
- **THEN** colunas trocam de posição visualmente durante o drag; ao soltar, nova ordem é salva via `PATCH /projects/:id/columns/reorder` e refletida para todos os usuários em tempo real

#### Scenario: Reordenar colunas nas configurações
- **WHEN** usuário acessa a tela de configurações e arrasta uma coluna para nova posição na lista
- **THEN** nova ordem é salva via API imediatamente

#### Scenario: Drag de coluna não interfere com drag de card
- **WHEN** usuário arrasta um card enquanto uma coluna também poderia ser arrastada
- **THEN** apenas o card é movido; o drag de coluna só é ativado ao arrastar o header específico da coluna

## ADDED Requirements

### Requirement: Drag-and-drop de cards entre colunas funcionando corretamente
O sistema SHALL persistir corretamente a mudança de coluna de um card ao soltar no destino, chamando a API e atualizando o status base.

#### Scenario: Card fixado na nova coluna após drop
- **WHEN** usuário arrasta card de uma coluna e solta em outra
- **THEN** card aparece na coluna destino, o status base da coluna é aplicado via `PATCH /tasks/:id/move` e o board reflete o estado correto para todos

#### Scenario: Rollback em caso de erro da API
- **WHEN** a chamada à API de move falha após o drop
- **THEN** card retorna visualmente para a coluna original e uma mensagem de erro é exibida
