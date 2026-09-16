## MODIFIED Requirements

### Requirement: Botão de criação de card por coluna envia para `/items`
O sistema SHALL exibir um botão "+" no rodapé de cada coluna do board para adicionar novo card. O formulário rápido SHALL continuar compacto e inline na coluna, contendo título, tipo (`TASK`/`BUG`), sprint opcional e versão opcional, enviando os dados para `POST /projects/:id/items`. A criação de TASK/BUG pela toolbar SHALL abrir o mesmo formulário completo amplo usado pela edição, com painel de propriedades e áreas de conteúdo. Sprint SHALL listar somente `PROPOSED` ou `OPEN`.

#### Scenario: Abrir formulário rápido de criação
- **WHEN** usuário clica no botão "+" de uma coluna
- **THEN** formulário compacto é exibido inline na coluna com título, tipo, sprint opcional, versão opcional e ações Adicionar/Cancelar, sem abrir o modal amplo

#### Scenario: Abrir formulário completo pela toolbar
- **WHEN** usuário seleciona `+ Task` ou `+ Bug` na toolbar
- **THEN** sistema abre o modal amplo com cabeçalho, navegação de áreas, painel de propriedades e ações fixas de Cancelar/Salvar

#### Scenario: Criar card TASK pelo modal amplo
- **WHEN** usuário informa um título válido, mantém tipo `TASK` e confirma em Salvar
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = TASK` na coluna correspondente, fecha o modal e o card aparece em tempo real

#### Scenario: Criar card BUG pelo modal amplo
- **WHEN** usuário informa um título válido, seleciona tipo `BUG` e confirma em Salvar
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = BUG` na coluna correspondente

#### Scenario: Associar sprint ou versão na criação
- **WHEN** usuário seleciona sprint elegível e/ou versão no formulário rápido ou no modal amplo e confirma
- **THEN** sistema cria o item preservando os vínculos selecionados; sem seleção, os vínculos ficam nulos

#### Scenario: Sprint fechada durante a criação
- **WHEN** uma sprint é fechada antes da confirmação
- **THEN** API rejeita a criação ou associação e não persiste vínculo inválido; o modal permanece disponível para correção e exibe erro

#### Scenario: Cancelar criação no modal amplo
- **WHEN** usuário pressiona Escape, clica no X, no backdrop ou em Cancelar
- **THEN** modal fecha sem criar o item e sem persistir valores digitados

#### Scenario: Card criado com campos padrão
- **WHEN** card é criado pelo modal amplo somente com título e tipo
- **THEN** item recebe prioridade `MEDIUM`, status `NOT_STARTED` e sem responsável; demais campos ficam vazios para edição posterior
