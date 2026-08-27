## MODIFIED Requirements

### Requirement: Botão de criação de card por coluna envia para `/items`
O sistema SHALL exibir um botão "+" no rodapé de cada coluna do board para adicionar novo card. O formulário rápido SHALL conter título, tipo (`TASK`/`BUG`) e um campo opcional de versão com as versões do projeto, enviando os dados para `POST /projects/:id/items`.

#### Scenario: Abrir formulário rápido de criação
- **WHEN** usuário clica no botão "+" de uma coluna
- **THEN** formulário compacto é exibido inline na coluna com campo de título, seletor de tipo, seletor opcional de versão e botões "Adicionar" e "Cancelar"

#### Scenario: Criar card TASK pelo formulário rápido
- **WHEN** usuário digita o título, mantém tipo `Task` e pressiona Enter ou clica em "Adicionar"
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = TASK` na coluna correspondente, sem versão quando nenhuma foi selecionada, formulário fecha e card aparece em tempo real

#### Scenario: Criar card BUG pelo formulário rápido
- **WHEN** usuário digita o título, seleciona tipo `Bug` e confirma
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = BUG` na coluna correspondente

#### Scenario: Associar versão na criação rápida
- **WHEN** usuário seleciona uma versão do projeto no formulário rápido e confirma a criação
- **THEN** sistema envia o `versionId` selecionado, persiste o vínculo no item e exibe a versão ao consultar o card

#### Scenario: Criação sem versão
- **WHEN** usuário mantém a opção `Sem versão` no formulário rápido
- **THEN** sistema cria o item sem vínculo de versão e não bloqueia a operação

#### Scenario: Versão de outro projeto não é aceita
- **WHEN** uma requisição tenta criar card com `versionId` que não pertence ao projeto ou tenant atual
- **THEN** API retorna erro de validação e não cria o item

#### Scenario: Cancelar criação
- **WHEN** usuário pressiona Escape ou clica em "Cancelar"
- **THEN** formulário fecha sem criar o item

#### Scenario: Card criado com campos padrão
- **WHEN** card é criado pelo formulário rápido somente com título, tipo e versão opcional
- **THEN** item recebe prioridade `MEDIUM`, status `NOT_STARTED`, sem responsável e com o vínculo de versão informado ou nulo
