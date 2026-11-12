# Spec Delta

## ADDED Requirements

### Requirement: Referência externa informativa

O sistema SHALL permitir que um item guarde uma referência externa composta por `externalSource` e `externalRef`, ambos opcionais e independentes. A referência SHALL ser tratada como informação de rastreabilidade, não como identidade: não há unicidade por projeto, upsert nem filtro por ela nesta versão.

#### Scenario: Criar item com referência externa
- **WHEN** um membro cria um item informando `externalSource` e `externalRef`
- **THEN** o item é criado com a referência e a devolve na leitura

#### Scenario: Referência repetida
- **WHEN** dois itens do mesmo projeto usam a mesma `externalSource` e `externalRef`
- **THEN** os dois itens existem independentemente, sem conflito

#### Scenario: Atualizar a referência
- **WHEN** um membro atualiza `externalSource` ou `externalRef` de um item
- **THEN** o novo valor é persistido e devolvido na leitura

#### Scenario: Sem upsert e sem filtro
- **WHEN** um cliente tenta usar `PUT /items/by-external-ref` ou filtrar a listagem por `externalSource`/`externalRef`
- **THEN** o endpoint não existe e o filtro não é aplicado
