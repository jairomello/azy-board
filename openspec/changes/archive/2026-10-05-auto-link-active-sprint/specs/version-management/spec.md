## ADDED Requirements

### Requirement: Vínculo automático à versão vigente na criação

Na criação de um card (TASK/BUG) **sem `versionId` explícito**, o sistema SHALL vinculá-lo automaticamente à **versão vigente** do projeto: a versão com `status != CANCELLED`, `releaseDate` não nula e **futura mais próxima** da data atual (menor `releaseDate >= hoje`); havendo empate, SHALL escolher a de menor `createdAt`. `versionId` explícito (ID ou `null`) SHALL ter precedência. O vínculo SHALL valer para criação individual e em lote, respeitar projeto/tenant e MUST NOT criar vínculo duplicado.

#### Scenario: Criação de task com versão vigente

- **WHEN** card TASK/BUG é criado sem informar versão e existe versão não cancelada com a próxima `releaseDate` futura
- **THEN** o card é vinculado automaticamente a essa versão

#### Scenario: Versão sem data não é candidata

- **WHEN** a única versão não cancelada não possui `releaseDate`
- **THEN** o card é criado sem vínculo automático de versão

#### Scenario: Versão cancelada não é candidata

- **WHEN** a versão com a próxima `releaseDate` está `CANCELLED`
- **THEN** ela é ignorada e o sistema considera a próxima candidata válida

#### Scenario: Empate de data entre versões

- **WHEN** mais de uma versão candidata tem a mesma `releaseDate`
- **THEN** o sistema vincula o card à de menor `createdAt`

#### Scenario: Versão explícita tem precedência

- **WHEN** card é criado informando `versionId` de uma versão existente
- **THEN** o vínculo automático não é aplicado e o card usa a versão informada

#### Scenario: Criação explícita sem versão

- **WHEN** card é criado informando `versionId: null`
- **THEN** o card é criado sem vínculo de versão, mesmo que exista versão vigente

#### Scenario: Criação em lote com versão vigente

- **WHEN** operações de criação de TASK/BUG em lote omitem a versão e existe versão vigente
- **THEN** cada card criado é vinculado à versão vigente, sem vínculo duplicado

#### Scenario: Sem versão vigente

- **WHEN** card TASK/BUG é criado sem informar versão e não há versão vigente
- **THEN** o card é criado normalmente sem vínculo de versão
