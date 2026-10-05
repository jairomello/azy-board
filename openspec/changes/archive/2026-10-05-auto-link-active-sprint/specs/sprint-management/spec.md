## MODIFIED Requirements

### Requirement: Associação de cards a sprints

O sistema SHALL permitir incluir e remover cards de uma sprint `PROPOSED` ou `OPEN`, respeitando projeto e tenant. O sistema SHALL rejeitar qualquer nova associação a sprint `CLOSED`, inclusive durante a criação ou edição de um item. Na **criação de um card (TASK/BUG) sem sprint explícita**, o sistema SHALL vinculá-lo automaticamente à **sprint vigente** — a sprint `OPEN` cujo intervalo `[startDate, endDate]` contém a data atual; havendo mais de uma candidata, SHALL escolher a de menor `createdAt`. `sprintId`/`sprintIds` explícito (ID, `null` ou lista vazia) SHALL ter precedência sobre o vínculo automático. O vínculo automático SHALL valer para criação individual e em lote e MUST NOT criar associação duplicada.

#### Scenario: Inclusão de card em sprint

- **WHEN** membro adiciona card à sprint `PROPOSED` ou `OPEN`
- **THEN** card é associado à sprint e aparece no filtro de sprint do board

#### Scenario: Inclusão em sprint fechada

- **WHEN** usuário tenta adicionar ou mover card para sprint `CLOSED`
- **THEN** sistema retorna 409 ou 422 e não cria nem altera a associação

#### Scenario: Criação de task com sprint vigente

- **WHEN** card TASK/BUG é criado sem informar sprint e existe sprint `OPEN` cujo intervalo de datas contém a data atual
- **THEN** o card é vinculado automaticamente a essa sprint e aparece no filtro dessa sprint

#### Scenario: Sprint aberta fora do intervalo de datas

- **WHEN** card TASK/BUG é criado sem informar sprint e a sprint `OPEN` está fora do intervalo `[startDate, endDate]` da data atual
- **THEN** o card é criado sem associação automática a sprint

#### Scenario: Mais de uma sprint vigente

- **WHEN** mais de uma sprint `OPEN` cobre a data atual
- **THEN** o sistema vincula o card à de menor `createdAt`

#### Scenario: Criação de task sem sprint vigente

- **WHEN** card TASK/BUG é criado sem informar sprint e não há sprint vigente
- **THEN** o card é criado normalmente sem associação a sprint

#### Scenario: Sprint explícita tem precedência

- **WHEN** card é criado informando `sprintId` de uma sprint existente
- **THEN** o vínculo automático não é aplicado e o card usa a sprint informada

#### Scenario: Criação explícita sem sprint

- **WHEN** card é criado informando `sprintId: null`
- **THEN** o card é criado sem associação, mesmo que exista sprint vigente

#### Scenario: Criação em lote com sprint vigente

- **WHEN** operações de criação de TASK/BUG em lote omitem a sprint e existe sprint vigente
- **THEN** cada card criado é vinculado à sprint vigente, sem associação duplicada

#### Scenario: Listagem de sprints

- **WHEN** usuário autorizado consulta sprints do projeto
- **THEN** sistema retorna sprints `PROPOSED`, `OPEN` e `CLOSED` para permitir consulta histórica

#### Scenario: Card sem sprint

- **WHEN** card não está associado a nenhuma sprint
- **THEN** card aparece apenas na visão "Todos" do board, não no filtro de sprint
