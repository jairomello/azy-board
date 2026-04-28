## ADDED Requirements

### Requirement: Autorrelacionamento de tasks (subtasks)
O sistema SHALL permitir que uma Task tenha um `parent_id` opcional apontando para outra Task, criando subtasks com profundidade ilimitada (recomendado: máximo 5 níveis).

#### Scenario: Criação de subtask
- **WHEN** membro cria uma task informando uma task pai como `parent_id`
- **THEN** sistema registra a subtask vinculada à task pai e atualiza o `ancestry_path` da subtask com o caminho completo de ancestrais

#### Scenario: Task pai que recebe subtask deixa de ser folha
- **WHEN** task folha recebe uma primeira subtask
- **THEN** task pai é removida do Kanban como card móvel e passa a ser um agregador de progresso; subtask criada aparece no Kanban como card

---

### Requirement: Leaf Rule — apenas tasks folha são movidas no Kanban
O sistema SHALL exibir no Kanban apenas as Tasks que não possuem tasks filhas (tasks folha). Tasks pai tornam-se automaticamente agregadoras de progresso e não são cards móveis.

#### Scenario: Task folha aparece no Kanban
- **WHEN** task não possui tasks filhas
- **THEN** task aparece como card móvel nas colunas do Kanban

#### Scenario: Task pai não aparece no Kanban como card móvel
- **WHEN** task possui ao menos uma task filha
- **THEN** task não aparece como card individual no Kanban; sua presença é representada pela swimlane do épico ou agrupamento de subtasks

#### Scenario: Drag-and-drop bloqueado em task pai
- **WHEN** usuário tenta arrastar card de task pai no Kanban
- **THEN** sistema exibe tooltip explicativo e não permite o drag (task pai não é movível diretamente)

---

### Requirement: Progresso calculado em tasks pai
O sistema SHALL calcular automaticamente o progresso de tasks pai com base no percentual de tasks folha descendentes concluídas.

#### Scenario: Cálculo de progresso
- **WHEN** task folha descendente muda para status DONE
- **THEN** progresso da task pai é recalculado: `(tasks_folha_DONE / total_tasks_folha_descendentes) * 100`

#### Scenario: Progresso exibido na tree view e no card pai
- **WHEN** usuário visualiza uma task pai na Tree View ou no card
- **THEN** sistema exibe a porcentagem de progresso e uma barra de progresso visual

#### Scenario: Progresso em cascata
- **WHEN** subtask de múltiplos níveis é concluída
- **THEN** progresso é recalculado em toda a cadeia de ancestrais até o nível de task, story e épico

---

### Requirement: Pontuação de tasks e agregação nos pais
O sistema SHALL suportar um campo numérico `points` (inteiro, nullable) em cada task. Apenas tasks folha recebem pontuação diretamente. Tasks pai SHALL exibir a soma dos pontos de todas as tasks folha descendentes.

#### Scenario: Atribuição de pontos a task folha
- **WHEN** membro edita o campo de pontos de uma task folha
- **THEN** sistema salva o valor e atualiza a soma de pontos em todos os ancestrais (task pai, story, épico, módulo)

#### Scenario: Soma de pontos em task pai
- **WHEN** usuário visualiza uma task pai no card ou na Tree View
- **THEN** campo de pontos exibe a soma total dos pontos de todas as tasks folha descendentes

#### Scenario: Pontos exibidos na swimlane do épico
- **WHEN** swimlane de épico é exibida no board
- **THEN** header da swimlane exibe o total de pontos do épico ao lado do progresso

#### Scenario: Pontos no Shadow Markdown
- **WHEN** agente faz GET `/projects/{id}/board.md`
- **THEN** cada card exibe seus pontos no formato `[Xpts]` ao lado do título

---

### Requirement: Breadcrumb dinâmico nos cards
O sistema SHALL exibir no card de cada task folha o caminho hierárquico completo: `Projeto > Módulo > Épico > Story > Task Pai > ... > Task Atual`.

#### Scenario: Breadcrumb truncado no card
- **WHEN** card é exibido no Kanban
- **THEN** breadcrumb aparece abaixo do título truncado com reticências se ultrapassar o espaço disponível

#### Scenario: Expansão do breadcrumb ao hover
- **WHEN** usuário passa o mouse sobre o breadcrumb truncado
- **THEN** sistema exibe o caminho completo em tooltip ou popover com links clicáveis para cada nível

#### Scenario: Navegação pelo breadcrumb
- **WHEN** usuário clica em um nível do breadcrumb expandido
- **THEN** sistema navega para a página ou detalhe do ancestral clicado

#### Scenario: Breadcrumb atualizado em cascade
- **WHEN** um ancestral é renomeado
- **THEN** `ancestry_path` de todas as tasks descendentes é atualizado automaticamente

---

### Requirement: Agente de IA cria subtasks via API
O sistema SHALL permitir que agentes de IA criem subtasks filhas de uma task pai existente via API e MCP.

#### Scenario: Agente identifica task pai sem filhos e cria subtasks
- **WHEN** agente faz POST `/projects/{id}/tasks` com `parent_id` de uma task existente
- **THEN** sistema cria a subtask, a task pai é promovida a agregador e o card da task pai some do Kanban, sendo substituído pelos cards das subtasks

#### Scenario: Novos cards de subtask aparecem em tempo real
- **WHEN** agente cria múltiplas subtasks via API
- **THEN** todos os usuários conectados ao board veem os novos cards aparecerem em tempo real com o avatar/badge da IA responsável
