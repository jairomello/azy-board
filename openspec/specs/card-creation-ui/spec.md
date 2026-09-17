## Purpose

Definir os requisitos da capacidade card creation ui.
## Requirements
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

### Requirement: Botões de criação na toolbar com Módulo incluído
O sistema SHALL exibir botões de criação de Módulo, Épico, História, Task e Bug na toolbar com labels encurtadas (`+ Módulo`, `+ Épico`, `+ História`, `+ Task`, `+ Bug`), mantendo cores e ícones identificadores de cada tipo. Os formulários de Épico e História SHALL usar accordions nas seções extensas, com primeira seção aberta e controles globais de expansão/recolhimento.

#### Scenario: Botão de criação de Módulo com label compacta
- **WHEN** a toolbar do board é renderizada
- **THEN** o primeiro botão de criação exibe label `+ Módulo` com ícone de módulo/pacote

#### Scenario: Funcionalidade de criação de Módulo preservada
- **WHEN** o usuário clica no botão `+ Módulo` da toolbar
- **THEN** a modal de criação de módulo é aberta com campos Nome e Descrição

#### Scenario: Botão de criação com label compacta para demais tipos
- **WHEN** a toolbar do board é renderizada
- **THEN** os botões de criação exibem labels no formato `+ Tipo` (ex.: `+ Épico`, `+ História`, `+ Task`, `+ Bug`) em vez do formato anterior `Novo Épico`, `Nova Task`

#### Scenario: Funcionalidade de criação preservada com accordions
- **WHEN** o usuário clica em qualquer botão de criação da toolbar
- **THEN** o modal correspondente é aberto com os campos existentes, e Épico/História exibem o padrão de accordion quando houver mais de uma seção

#### Scenario: Cancelar criação em seção recolhida
- **WHEN** usuário recolhe ou expande seções e cancela o formulário
- **THEN** nenhuma entidade é criada e nenhum valor é persistido

### Requirement: Campo sequenceCode no formulário de item
O sistema SHALL incluir um campo editável para `sequenceCode` no formulário de criação e edição de itens (ItemModal, StoryModal, EpicModal).

#### Scenario: Campo exibido no formulário de criação
- **WHEN** membro abre o formulário de criação de item (TASK, BUG, STORY ou EPIC)
- **THEN** campo "Código" é exibido com placeholder "Gerado automaticamente" e permite edição opcional

#### Scenario: Campo exibido no formulário de edição
- **WHEN** membro abre o formulário de edição de um item existente
- **THEN** campo "Código" é exibido com o valor atual do `sequenceCode` e permite edição

#### Scenario: Código enviado na criação
- **WHEN** membro preenche o campo "Código" e salva o item
- **THEN** `sequenceCode` é incluído no payload de `POST /projects/:id/items`

#### Scenario: Código enviado na edição
- **WHEN** membro altera o campo "Código" e salva
- **THEN** `sequenceCode` é incluído no payload de `PATCH /projects/:id/items/:itemId`

#### Scenario: Campo vazio na criação gera código automático
- **WHEN** membro deixa o campo "Código" vazio na criação
- **THEN** o campo não é enviado no payload e o backend gera automaticamente o próximo código disponível

