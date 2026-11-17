# Spec Delta

## ADDED Requirements

### Requirement: Ocultar ramos vazios na árvore
A grade em árvore SHALL respeitar `hideEmptyEpics` e `hideEmptyStories` com a mesma
semântica do Kanban: um módulo ou épico sem descendentes visíveis e uma história sem filhos visíveis
após os demais filtros deixam de ser exibidos. Quando os dois filtros estiverem ativos, as
histórias SHALL ser podadas antes dos épicos, para que um épico que só possuía histórias
vazias também seja ocultado. A poda SHALL NOT alterar os itens, apenas a apresentação.

#### Scenario: Ocultar histórias vazias
- **WHEN** `hideEmptyStories` está ativo na árvore
- **THEN** histórias sem filhos visíveis não são exibidas e suas tarefas não existem

#### Scenario: Ocultar ramos vazios
- **WHEN** `hideEmptyEpics` está ativo na árvore
- **THEN** módulos e épicos sem descendentes visíveis não são exibidos

#### Scenario: Combinação dos dois
- **WHEN** os dois filtros estão ativos e um épico só possuía histórias vazias
- **THEN** tanto as histórias quanto o épico deixam de ser exibidos

#### Scenario: Filtros de conteúdo
- **WHEN** um filtro de conteúdo remove todas as tarefas de uma história
- **THEN** a história é considerada vazia para efeito das ocultações

#### Scenario: Sem filtros de vazio
- **WHEN** os dois filtros estão desligados
- **THEN** a árvore mostra todos os ramos do recorte, inclusive vazios
