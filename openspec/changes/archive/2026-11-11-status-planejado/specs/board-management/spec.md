# Spec Delta

## MODIFIED Requirements

### Requirement: Colunas customizáveis por projeto

O sistema SHALL permitir que administradores criem, renomeiem, reordenem e excluam colunas do board de um projeto. O status base da coluna SHALL aceitar `NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `DONE` e `CANCELLED`.

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

#### Scenario: Reordenar coluna arrastando o header

- **WHEN** usuário arrasta o header de uma coluna para outra posição
- **THEN** nova ordem é salva via `PATCH /projects/:id/columns/reorder` e refletida em tempo real

#### Scenario: Exclusão de coluna com cards

- **WHEN** admin tenta excluir coluna que contém cards
- **THEN** sistema solicita confirmação e move os cards para coluna especificada antes de excluir

---

## ADDED Requirements

### Requirement: Status planejado separa priorizado de backlog

O sistema SHALL distinguir, no dado e na apresentação, o trabalho priorizado e ainda não iniciado (`PLANNED`) do trabalho não priorizado (`NOT_STARTED` no `Backlog`). Ao mover um card para uma coluna cujo `baseStatus` seja `PLANNED`, o item SHALL receber `status = PLANNED`; ao liberar a atribuição, o item SHALL manter o `baseStatus` da coluna em que está. `PLANNED` SHALL ter peso de avanço 0 e SHALL NOT participar da faixa do fluxo em progresso.

#### Scenario: Card priorizado mostra status próprio

- **WHEN** card está em uma coluna com `baseStatus = PLANNED`
- **THEN** o card exibe "Planejada" e os filtros por status conseguem distingui-lo de um card no `Backlog`

#### Scenario: Liberar card não volta o status para não iniciado

- **WHEN** card em coluna `PLANNED` tem a atribuição liberada
- **THEN** o item permanece com `status = PLANNED` e na mesma coluna

#### Scenario: Planejado não altera o avanço

- **WHEN** um projeto tem colunas `NOT_STARTED`, `PLANNED`, `IN_PROGRESS` e `DONE`
- **THEN** `PLANNED` vale 0 no cálculo de avanço, como `NOT_STARTED`, e não desloca a faixa das colunas em progresso
