# Spec Delta

## MODIFIED Requirements

### Requirement: Colunas customizáveis por projeto
O sistema SHALL permitir que administradores criem, renomeiem, reordenem e excluam colunas do board de um projeto. O status base de uma coluna SHALL ser um de `NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `IN_HOMOLOGATION`, `BLOCKED`, `DONE`, `CANCELLED`; `ARCHIVED` NÃO SHALL ser status base de coluna.

#### Scenario: Criação de coluna com mapeamento de status
- **WHEN** admin cria coluna informando nome e status base
- **THEN** sistema cria a coluna e qualquer item movido para ela receberá o status base configurado

#### Scenario: Coluna de homologação
- **WHEN** admin cria ou converte uma coluna para o status base `IN_HOMOLOGATION`
- **THEN** os cards movidos para ela passam a exibir "Em homologação" e a coluna participa da faixa do fluxo no avanço

#### Scenario: Reordenar coluna arrastando o header
- **WHEN** usuário arrasta o header de uma coluna para outra posição
- **THEN** nova ordem é salva via `PATCH /projects/:id/columns/reorder` e refletida em tempo real

#### Scenario: Exclusão de coluna com cards
- **WHEN** admin tenta excluir coluna que contém cards
- **THEN** sistema solicita confirmação e move os cards para coluna especificada antes de excluir
