## MODIFIED Requirements

### Requirement: Leaf Rule — apenas items folha são móveis no Kanban
O sistema SHALL permitir movimentação de items `TASK` e `BUG` no Kanban. Em projetos `HIERARCHICAL`, EPICs nunca são cards móveis, STORYs são lanes no modo padrão e somente STORYs folha podem ser cards móveis quando `storyDisplay = cards`; items TASK/BUG com filhos são agregadores e não podem ser movidos. Em projetos `SIMPLE`, EPICs e módulos não participam da apresentação, a STORY fixa não é card móvel e todos os TASKs/BUGs vinculados diretamente a ela aparecem como cards no fluxo único.

#### Scenario: Item TASK/BUG aparece no board simples
- **WHEN** item TASK ou BUG pertence a um projeto `SIMPLE` e está vinculado à STORY fixa
- **THEN** item aparece como card móvel em uma das colunas do Kanban único

#### Scenario: Item pai simples permanece visível
- **WHEN** item TASK ou BUG possui filhos, mas pertence a um projeto `SIMPLE`
- **THEN** o item e seus descendentes preservados aparecem como cards no fluxo único, sem exigir uma lane hierárquica

#### Scenario: Breadcrumb simples não inventa hierarquia
- **WHEN** card é exibido em projeto `SIMPLE`
- **THEN** breadcrumb não exibe módulo ou EPIC inexistente e identifica no máximo a STORY fixa e o item atual

#### Scenario: Hierarquia permanece no modo hierárquico
- **WHEN** card é exibido em projeto `HIERARCHICAL`
- **THEN** sistema mantém a Leaf Rule e o breadcrumb com Módulo, EPIC, STORY e item conforme as regras existentes

#### Scenario: EPIC nunca é card móvel
- **WHEN** board Kanban de projeto `HIERARCHICAL` é exibido
- **THEN** nenhum item com `type = EPIC` aparece como card móvel

#### Scenario: STORY no modo de lanes não é card móvel
- **WHEN** `storyDisplay = lanes` em projeto `HIERARCHICAL`
- **THEN** cada STORY é representada como lane horizontal, independentemente de possuir filhos

#### Scenario: STORY folha no modo de cards é móvel
- **WHEN** `storyDisplay = cards` e uma STORY não possui filhos em projeto `HIERARCHICAL`
- **THEN** a STORY aparece como card móvel conforme `leaf-story-kanban`

#### Scenario: Item TASK/BUG pai não aparece como card móvel no modo hierárquico
- **WHEN** item TASK ou BUG possui ao menos um item filho em projeto `HIERARCHICAL`
- **THEN** item não aparece como card móvel; sua presença é agregada na lane da história e do épico ancestrais

#### Scenario: Drag-and-drop bloqueado em item TASK/BUG pai
- **WHEN** usuário tenta arrastar card de item TASK/BUG pai no Kanban hierárquico
- **THEN** sistema exibe tooltip explicativo e não permite o drag

### Requirement: Breadcrumb dinâmico nos cards
O sistema SHALL exibir o caminho hierárquico completo dos cards em projetos `HIERARCHICAL`. Em projetos `SIMPLE`, SHALL exibir um breadcrumb reduzido sem módulo ou EPIC, usando a STORY fixa como contexto quando aplicável.

#### Scenario: Breadcrumb de card simples
- **WHEN** card TASK/BUG é exibido em projeto `SIMPLE`
- **THEN** breadcrumb exibe `História fixa > Item` ou somente o item quando o contexto já estiver visível no board

#### Scenario: Breadcrumb truncado no card hierárquico
- **WHEN** card é exibido em projeto `HIERARCHICAL`
- **THEN** breadcrumb aparece abaixo do título, truncado com reticências se ultrapassar o espaço disponível

#### Scenario: Expansão do breadcrumb ao hover
- **WHEN** usuário passa o mouse sobre o breadcrumb truncado em projeto `HIERARCHICAL`
- **THEN** sistema exibe o caminho completo em tooltip com os tipos de cada ancestral indicados pelos ícones correspondentes

#### Scenario: Breadcrumb atualizado após conversão
- **WHEN** projeto é convertido entre modos
- **THEN** sistema recalcula `ancestryPath` dos itens preservados e a interface exibe o formato correspondente ao novo modo

#### Scenario: Breadcrumb atualizado quando ancestral é renomeado
- **WHEN** um ancestral é renomeado em projeto `HIERARCHICAL`
- **THEN** `ancestryPath` de todos os items descendentes é atualizado automaticamente
