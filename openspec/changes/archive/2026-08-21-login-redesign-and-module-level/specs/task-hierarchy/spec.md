## MODIFIED Requirements

### Requirement: Hierarquia completa com Módulo
O sistema SHALL suportar a hierarquia completa Módulo >> Épico >> História >> TASK/BUG >> subtask. O `ancestryPath` SHALL incluir o módulo no caminho hierárquico. A Leaf Rule permanece inalterada (apenas items folha TASK/BUG são cards móveis).

#### Scenario: Breadcrumb inclui módulo
- **WHEN** card é exibido no Kanban
- **THEN** breadcrumb aparece abaixo do título com o caminho completo: `Módulo > Épico > História > Task`

#### Scenario: Hierarquia visual no board
- **WHEN** board é renderizado
- **THEN** a hierarquia visual exibe 4 níveis collapsíveis: Módulo >> Épico >> História >> Cards

#### Scenario: Item TASK folha aparece no Kanban
- **WHEN** item com `type IN (TASK, BUG)` não possui itens filhos
- **THEN** item aparece como card móvel nas colunas do Kanban dentro da StorySwimlane, que está dentro da Swimlane de Épico, que está dentro da ModuleSwimlane

#### Scenario: EPIC nunca é card móvel
- **WHEN** board Kanban é exibido
- **THEN** nenhum item com `type = EPIC` aparece como card móvel

#### Scenario: STORY no modo de lanes não é card móvel
- **WHEN** `storyDisplay = lanes`
- **THEN** cada STORY é representada como lane horizontal, independentemente de possuir filhos

#### Scenario: STORY folha no modo de cards é móvel
- **WHEN** `storyDisplay = cards` e uma STORY não possui filhos
- **THEN** a STORY aparece como card móvel conforme `leaf-story-kanban`

#### Scenario: Item TASK/BUG pai não aparece no Kanban como card móvel
- **WHEN** item TASK ou BUG possui ao menos um item filho
- **THEN** item não aparece como card móvel; sua presença é agregada na lane da história e do épico ancestrais

#### Scenario: Drag-and-drop bloqueado em item TASK/BUG pai
- **WHEN** usuário tenta arrastar card de item TASK/BUG pai no Kanban
- **THEN** sistema exibe tooltip explicativo e não permite o drag

---

### Requirement: Progresso calculado em items pai
O sistema SHALL calcular automaticamente o progresso de qualquer item pai com base no percentual de items folha TASK/BUG descendentes concluídos. O progresso SHALL ser exibido em todos os níveis: ModuleSwimlane, Swimlane de Épico e StorySwimlane.

#### Scenario: Cálculo de progresso ao concluir item folha
- **WHEN** item folha TASK ou BUG descendente muda para status DONE
- **THEN** progresso do item pai é recalculado: `(items_folha_DONE / total_items_folha_descendentes) * 100`

#### Scenario: Progresso exibido na ModuleSwimlane
- **WHEN** ModuleSwimlane é renderizada
- **THEN** header exibe o progresso agregado de todos os épicos do módulo

#### Scenario: Progresso exibido na swimlane do épico
- **WHEN** swimlane de EPIC é exibida no board
- **THEN** header da swimlane exibe o total de pontos do épico ao lado do progresso

#### Scenario: Progresso em cascata até o Módulo
- **WHEN** item folha TASK/BUG de múltiplos níveis é concluído
- **THEN** progresso é recalculado em toda a cadeia de ancestrais (TASK pai → STORY → EPIC → Módulo)

---

### Requirement: Pontuação de items e agregação nos pais
O sistema SHALL suportar um campo numérico `points` (inteiro, nullable) em cada item. Apenas items folha TASK/BUG recebem pontuação diretamente. Items pai SHALL exibir a soma dos pontos de todas as tasks folha descendentes. A pontuação SHALL ser agregada até o nível de Módulo.

#### Scenario: Atribuição de pontos a item folha
- **WHEN** membro edita o campo de pontos de um item folha TASK ou BUG
- **THEN** sistema salva o valor e atualiza a soma de pontos em todos os ancestrais (item pai, STORY, EPIC, Módulo)

#### Scenario: Pontos exibidos na ModuleSwimlane
- **WHEN** ModuleSwimlane é renderizada
- **THEN** header exibe o total de pontos de todos os épicos do módulo

---

### Requirement: Agente de IA cria items via API
O sistema SHALL permitir que agentes de IA criem qualquer tipo de item via API, incluindo STORYs filhas de EPICs e TASKs filhas de STORYs. A hierarquia com Módulo é transparente para a API (o `moduleId` é herdado do épico pai).

#### Scenario: Agente cria subtask de um TASK via API
- **WHEN** agente faz `POST /projects/{id}/items` com `parent_id` de um TASK existente e `type = TASK`
- **THEN** sistema cria a subtask, o TASK pai é promovido a agregador e o card do pai some do Kanban, substituído pelos cards das subtasks

#### Scenario: Novos cards aparecem em tempo real
- **WHEN** agente cria múltiplos items via API
- **THEN** todos os usuários conectados ao board veem os novos cards aparecerem em tempo real
