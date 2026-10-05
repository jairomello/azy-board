## MODIFIED Requirements

### Requirement: Breadcrumb dinâmico nos cards
O sistema SHALL exibir o caminho hierárquico completo em cards de projetos `HIERARCHICAL`: `Projeto > Módulo > Épico > História > Task Pai > ... > Item Atual`. Em projetos `SIMPLE`, SHALL exibir breadcrumb reduzido usando a STORY fixa quando aplicável. O `ancestryPath` armazena `[{ id, title, type }]` de cada ancestral.

#### Scenario: Breadcrumb truncado no card
- **WHEN** card é exibido no Kanban
- **THEN** breadcrumb aparece acima do título (entre a linha de topo e o título), truncado com reticências se ultrapassar o espaço disponível

#### Scenario: Expansão do breadcrumb ao hover
- **WHEN** usuário passa o mouse sobre o breadcrumb truncado
- **THEN** sistema exibe o caminho completo em tooltip com os tipos de cada ancestral indicados pelos ícones correspondentes

#### Scenario: Breadcrumb atualizado em cascade
- **WHEN** um ancestral é renomeado
- **THEN** `ancestryPath` de todos os items descendentes é atualizado automaticamente
