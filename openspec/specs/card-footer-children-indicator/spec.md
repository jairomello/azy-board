## ADDED Requirements

### Requirement: Campo `childrenCount` retornado pela API

A API de listagem de itens do board SHALL retornar o campo `childrenCount` (inteiro ≥ 0) em cada item, representando o número de filhos diretos do item. O tipo `CardData` em `@azy-board/types` SHALL incluir `childrenCount: number`.

#### Scenario: Item sem filhos

- **WHEN** a API retorna um item que não tem filhos
- **THEN** `childrenCount` é `0`

#### Scenario: Item com filhos diretos

- **WHEN** a API retorna um item que tem N filhos diretos
- **THEN** `childrenCount` é `N`

---

### Requirement: Indicador visual de filhos no footer do card

O rodapé do `KanbanCard` SHALL exibir um indicador de filhos quando `childrenCount > 0`. O indicador SHALL consistir no ícone `GitBranch` do Lucide React seguido do número de filhos, sem texto descritivo adicional. O indicador SHALL ter um tooltip com o texto "X subtasks".

#### Scenario: Card com filhos exibe indicador

- **WHEN** o card tem `childrenCount > 0`
- **THEN** o footer exibe o ícone GitBranch e o número de filhos (ex: `⎇ 3`)

#### Scenario: Card sem filhos não exibe indicador

- **WHEN** o card tem `childrenCount === 0`
- **THEN** nenhum indicador de filhos é renderizado no footer

#### Scenario: Tooltip do indicador

- **WHEN** o usuário passa o mouse sobre o indicador de filhos
- **THEN** um tooltip exibe "X subtasks" onde X é o valor de `childrenCount`
