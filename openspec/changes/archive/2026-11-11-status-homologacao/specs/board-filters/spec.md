# Spec Delta

## ADDED Requirements

### Requirement: Opção de status em homologação no filtro

O filtro de Status do board SHALL oferecer a opção `IN_HOMOLOGATION`, rotulada "Em homologação" em pt-BR, com o mesmo rótulo usado na coluna de status da grade.

#### Scenario: Filtrar cards em homologação

- **WHEN** o usuário marca a opção "Em homologação" no filtro de Status
- **THEN** apenas cards com `status = IN_HOMOLOGATION` são exibidos

#### Scenario: Rótulo consistente

- **WHEN** o idioma é pt-BR, en ou es
- **THEN** o rótulo do filtro é idêntico ao da coluna de status da grade para o mesmo idioma
