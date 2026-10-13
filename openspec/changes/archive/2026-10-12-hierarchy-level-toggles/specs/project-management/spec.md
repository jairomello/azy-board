# Spec Delta

## ADDED Requirements

### Requirement: Projeto aceita as opções de ocultar módulos e épicos

O sistema SHALL aceitar, na criação e na edição do projeto, as opções `hideModules`
e `hideEpics` como booleanos opcionais, persistindo-os por projeto e devolvendo-os
nas respostas. Quando não informados, SHALL usar `false`.

#### Scenario: Criação com opções

- **WHEN** um usuário cria um projeto `HIERARCHICAL` informando `hideModules` e/ou `hideEpics`
- **THEN** o sistema persiste os valores informados e os retorna na resposta

#### Scenario: Criação sem opções

- **WHEN** um usuário cria um projeto sem informar as opções
- **THEN** o sistema persiste ambos como `false`

#### Scenario: Edição apenas das opções

- **WHEN** um ADMIN envia `PATCH /projects/:id` alterando somente uma das opções
- **THEN** o sistema aplica o recolhimento correspondente sem alterar os demais campos do projeto
