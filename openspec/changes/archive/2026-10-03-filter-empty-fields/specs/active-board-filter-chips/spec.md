## ADDED Requirements

### Requirement: Chip para filtro por valor vazio
A linha de filtros ativos SHALL exibir um chip para cada filtro de valor vazio aplicado (Sprint, Versão, Responsável, Autor ou Centro de Custo), com rótulo legível do estado vazio (`Sem sprint`, `Sem versão`, `Não atribuído`, `Sem autor`, `Sem centro de custo`). O estado neutro (sem filtro) SHALL NOT gerar chip.

#### Scenario: Chip de sprint vazia
- **WHEN** o filtro de Sprint está no estado de valor vazio
- **THEN** a linha exibe um chip com o rótulo `Sem sprint` e botão acessível de remoção

#### Scenario: Remover chip de valor vazio
- **WHEN** o usuário remove o chip de valor vazio de um campo
- **THEN** somente esse campo volta ao estado neutro, o Board é recalculado e os demais chips permanecem

#### Scenario: Estado neutro sem chip
- **WHEN** o filtro de um campo está no estado neutro
- **THEN** nenhum chip é exibido para esse campo

#### Scenario: Múltiplos filtros de valor vazio
- **WHEN** mais de um campo está no estado de valor vazio
- **THEN** a linha exibe um chip para cada campo, cada um removível independentemente
