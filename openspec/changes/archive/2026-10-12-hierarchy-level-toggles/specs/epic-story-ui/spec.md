# Spec Delta

## ADDED Requirements

### Requirement: Nível de épico oculto no board

Com a opção de ocultar épicos ligada, o sistema SHALL deixar de exibir o nível de
épico: as swimlanes de épico não são renderizadas, o botão `+ Novo Épico` não é
exibido e as histórias passam a ser criadas/associadas ao épico único
automaticamente.

#### Scenario: Swimlanes de épico ausentes

- **WHEN** o projeto tem épicos ocultos
- **THEN** o board não renderiza swimlanes de épico

#### Scenario: Botão de criação de épico oculto

- **WHEN** o projeto tem épicos ocultos
- **THEN** o toolbar não exibe o botão `+ Novo Épico`

#### Scenario: História criada sem escolher épico

- **WHEN** uma história é criada em projeto com épicos ocultos
- **THEN** o sistema vincula a história ao épico único sem exigir seleção de épico
