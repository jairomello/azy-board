## ADDED Requirements

### Requirement: Criar e gerenciar tags no nível do projeto
O sistema SHALL permitir criar, renomear, mudar a cor e excluir tags vinculadas a um projeto. As tags são compartilhadas por todos os membros do projeto.

#### Scenario: Criação de tag
- **WHEN** membro cria tag com nome e cor
- **THEN** tag é registrada no projeto e fica disponível para associação em qualquer card do projeto

#### Scenario: Renomeação de tag
- **WHEN** admin renomeia uma tag
- **THEN** novo nome é refletido em todos os cards que possuem essa tag sem necessidade de reatribuição

#### Scenario: Exclusão de tag
- **WHEN** admin exclui uma tag
- **THEN** tag é removida do catálogo e desassociada de todos os cards que a possuíam

---

### Requirement: Associar múltiplas tags a um card
O sistema SHALL permitir associar zero ou mais tags de qualquer projeto a um card (task).

#### Scenario: Adição de tag a card
- **WHEN** membro seleciona uma ou mais tags no modal de edição do card
- **THEN** tags são exibidas no card como chips coloridos

#### Scenario: Remoção de tag de card
- **WHEN** membro remove uma tag do card
- **THEN** chip da tag desaparece do card imediatamente

---

### Requirement: Filtro do board por tag
O sistema SHALL permitir filtrar o Kanban e a Tree View por uma ou mais tags simultaneamente.

#### Scenario: Filtro por tag única
- **WHEN** usuário seleciona uma tag no filtro do board
- **THEN** apenas cards que possuem aquela tag são exibidos

#### Scenario: Filtro por múltiplas tags (OR)
- **WHEN** usuário seleciona múltiplas tags no filtro
- **THEN** sistema exibe cards que possuem ao menos uma das tags selecionadas

#### Scenario: Limpeza de filtro de tags
- **WHEN** usuário remove todas as tags selecionadas no filtro
- **THEN** board volta a exibir todos os cards sem filtro de tag

---

### Requirement: Tags visíveis e acessíveis para agentes de IA
O sistema SHALL incluir as tags de um card na resposta da API REST e no Shadow Markdown para que agentes de IA possam ler e atribuir tags via API.

#### Scenario: Tags no Shadow Markdown
- **WHEN** agente faz GET `/projects/{id}/board.md`
- **THEN** cada card exibe suas tags no formato `[tag1, tag2]` ao lado do título

#### Scenario: Agente atribui tag via API
- **WHEN** agente faz PATCH `/projects/{id}/tasks/{taskId}` com `{ tags: ["tag-id-1"] }`
- **THEN** sistema atribui as tags ao card e reflete no board em tempo real
