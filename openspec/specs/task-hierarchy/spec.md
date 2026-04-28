## MODIFIED Requirements

### Requirement: Autorrelacionamento de items (subtasks e hierarquia completa)
O sistema SHALL permitir que qualquer item tenha um `parent_id` apontando para outro item da tabela `items`, formando a hierarquia completa EPIC → STORY → TASK/BUG → subtask (TASK/BUG). A profundidade máxima recomendada é 5 níveis abaixo do STORY.

#### Scenario: Criação de subtask de TASK
- **WHEN** membro cria um item do tipo TASK informando `parentId` de outro TASK existente
- **THEN** sistema registra a subtask vinculada ao item pai e atualiza o `ancestryPath` da subtask com o caminho completo de ancestrais incluindo tipo de cada nó

#### Scenario: Item pai que recebe filho deixa de ser folha
- **WHEN** item folha do tipo TASK recebe um primeiro item filho
- **THEN** item pai é removido do Kanban como card móvel e passa a ser um agregador de progresso; item filho criado aparece no Kanban como card

---

### Requirement: Leaf Rule — apenas items TASK/BUG folha são cards móveis no Kanban
O sistema SHALL exibir no Kanban apenas items do tipo TASK ou BUG que não possuem filhos (items folha). Items do tipo EPIC e STORY nunca são cards móveis. Items TASK/BUG com filhos são agregadores e também não aparecem como cards.

#### Scenario: Item TASK folha aparece no Kanban
- **WHEN** item com `type IN (TASK, BUG)` não possui itens filhos
- **THEN** item aparece como card móvel nas colunas do Kanban

#### Scenario: Item EPIC e STORY nunca são cards móveis
- **WHEN** board Kanban é exibido
- **THEN** nenhum item com `type IN (EPIC, STORY)` aparece como card móvel, independente de ter filhos

#### Scenario: Item TASK/BUG pai não aparece no Kanban como card móvel
- **WHEN** item TASK ou BUG possui ao menos um item filho
- **THEN** item não aparece como card individual no Kanban; sua presença é representada pela swimlane do épico ancestral

#### Scenario: Drag-and-drop bloqueado em item TASK/BUG pai
- **WHEN** usuário tenta arrastar card de item TASK/BUG pai no Kanban
- **THEN** sistema exibe tooltip explicativo e não permite o drag

---

### Requirement: Progresso calculado em items pai
O sistema SHALL calcular automaticamente o progresso de qualquer item pai com base no percentual de items folha TASK/BUG descendentes concluídos.

#### Scenario: Cálculo de progresso ao concluir item folha
- **WHEN** item folha TASK ou BUG descendente muda para status DONE
- **THEN** progresso do item pai é recalculado: `(items_folha_DONE / total_items_folha_descendentes) * 100`

#### Scenario: Progresso exibido na tree view e no card pai
- **WHEN** usuário visualiza um item pai na Tree View ou no card
- **THEN** sistema exibe a porcentagem de progresso e uma barra de progresso visual

#### Scenario: Progresso em cascata até o EPIC
- **WHEN** item folha TASK/BUG de múltiplos níveis é concluído
- **THEN** progresso é recalculado em toda a cadeia de ancestrais (TASK pai → STORY → EPIC)

---

### Requirement: Pontuação de items e agregação nos pais
O sistema SHALL suportar um campo numérico `points` (inteiro, nullable) em cada item. Apenas items folha TASK/BUG recebem pontuação diretamente. Items pai SHALL exibir a soma dos pontos de todas as tasks folha descendentes.

#### Scenario: Atribuição de pontos a item folha
- **WHEN** membro edita o campo de pontos de um item folha TASK ou BUG
- **THEN** sistema salva o valor e atualiza a soma de pontos em todos os ancestrais (item pai, STORY, EPIC)

#### Scenario: Soma de pontos em item pai
- **WHEN** usuário visualiza um item pai no card ou na Tree View
- **THEN** campo de pontos exibe a soma total dos pontos de todas as tasks folha descendentes

#### Scenario: Pontos exibidos na swimlane do épico
- **WHEN** swimlane de EPIC é exibida no board
- **THEN** header da swimlane exibe o total de pontos do épico ao lado do progresso

---

### Requirement: Breadcrumb dinâmico nos cards
O sistema SHALL exibir no card de cada item folha o caminho hierárquico completo: `Projeto > Módulo > Épico > História > Task Pai > ... > Item Atual`. O `ancestryPath` armazena `[{ id, title, type }]` de cada ancestral.

#### Scenario: Breadcrumb truncado no card
- **WHEN** card é exibido no Kanban
- **THEN** breadcrumb aparece abaixo do título, truncado com reticências se ultrapassar o espaço disponível

#### Scenario: Expansão do breadcrumb ao hover
- **WHEN** usuário passa o mouse sobre o breadcrumb truncado
- **THEN** sistema exibe o caminho completo em tooltip com os tipos de cada ancestral indicados pelos ícones correspondentes

#### Scenario: Breadcrumb atualizado em cascade
- **WHEN** um ancestral é renomeado
- **THEN** `ancestryPath` de todos os items descendentes é atualizado automaticamente

---

### Requirement: Agente de IA cria items via API
O sistema SHALL permitir que agentes de IA criem qualquer tipo de item via API, incluindo STORYs filhas de EPICs e TASKs filhas de STORYs.

#### Scenario: Agente cria subtask de um TASK via API
- **WHEN** agente faz `POST /projects/{id}/items` com `parent_id` de um TASK existente e `type = TASK`
- **THEN** sistema cria a subtask, o TASK pai é promovido a agregador e o card do pai some do Kanban, substituído pelos cards das subtasks

#### Scenario: Novos cards aparecem em tempo real
- **WHEN** agente cria múltiplos items via API
- **THEN** todos os usuários conectados ao board veem os novos cards aparecerem em tempo real
