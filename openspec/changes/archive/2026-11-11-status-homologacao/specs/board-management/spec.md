# Spec Delta

## MODIFIED Requirements

### Requirement: Colunas customizáveis por projeto
O sistema SHALL permitir que administradores criem, renomeiem, reordenem e excluam colunas do board de um projeto. O status base de uma coluna SHALL ser um de `NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `IN_HOMOLOGATION`, `BLOCKED`, `DONE`, `CANCELLED`; `ARCHIVED` NÃO SHALL ser status base de coluna.

#### Scenario: Criação de coluna com mapeamento de status
- **WHEN** admin cria coluna informando nome e status base
- **THEN** sistema cria a coluna e qualquer item movido para ela receberá o status base configurado

#### Scenario: Coluna com status base planejado
- **WHEN** admin cria ou edita uma coluna com status base `PLANNED`
- **THEN** o sistema aceita a configuração e todo card movido para essa coluna passa a exibir o status "Planejada", distinto de "Não iniciada"

#### Scenario: Coluna com status base bloqueado ou cancelado
- **WHEN** admin cria uma coluna com status base `BLOCKED` ou `CANCELLED`
- **THEN** o sistema aceita a configuração, em linha com os status base documentados

#### Scenario: Trocar o status base de uma coluna existente
- **WHEN** admin altera o status base de uma coluna que já tem cards
- **THEN** os cards cujo status era igual ao status base anterior passam a ter o novo status na mesma operação, e a resposta reflete a coluna atualizada

#### Scenario: Status divergente é preservado na troca da coluna
- **WHEN** um card na coluna está com status diferente do status base anterior (por exemplo, `BLOCKED`)
- **THEN** a troca do status base da coluna não sobrescreve o status desse card

#### Scenario: Coluna de homologação
- **WHEN** admin cria ou converte uma coluna para o status base `IN_HOMOLOGATION`
- **THEN** os cards movidos para ela passam a exibir "Em homologação" e a coluna participa da faixa do fluxo no avanço

#### Scenario: Reordenar coluna arrastando o header
- **WHEN** usuário arrasta o header de uma coluna para outra posição
- **THEN** nova ordem é salva via `PATCH /projects/:id/columns/reorder` e refletida em tempo real

#### Scenario: Exclusão de coluna com cards
- **WHEN** admin tenta excluir coluna que contém cards
- **THEN** sistema solicita confirmação e move os cards para coluna especificada antes de excluir
