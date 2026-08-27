## MODIFIED Requirements

### Requirement: Botão de criação de card por coluna envia para `/items`
O sistema SHALL exibir um botão "+" no rodapé de cada coluna do board para adicionar novo card. O formulário rápido SHALL conter título, tipo (`TASK`/`BUG`), um campo opcional de sprint e um campo opcional de versão, enviando os dados para `POST /projects/:id/items`. O campo de sprint SHALL listar somente sprints `PROPOSED` ou `OPEN`.

#### Scenario: Abrir formulário rápido
- **WHEN** usuário clica no botão "+" de uma coluna
- **THEN** formulário compacto é exibido inline com título, tipo, sprint opcional, versão opcional e ações Adicionar/Cancelar

#### Scenario: Formulário sem sprints cadastradas
- **WHEN** usuário abre o formulário em projeto sem sprints
- **THEN** campo Sprint permanece visível, seleciona `Sem sprint` e indica `Nenhuma sprint cadastrada`

#### Scenario: Criar TASK com sprint aberta
- **WHEN** usuário cria TASK selecionando sprint `PROPOSED` ou `OPEN`
- **THEN** sistema cria o item e associa a sprint selecionada

#### Scenario: Criar BUG sem sprint
- **WHEN** usuário cria BUG mantendo `Sem sprint`
- **THEN** sistema cria o item sem associação de sprint

#### Scenario: Sprint fechada não aparece
- **WHEN** existem sprints `CLOSED` no projeto
- **THEN** elas não aparecem nas opções do campo Sprint

#### Scenario: Fechamento durante a criação
- **WHEN** uma sprint é fechada depois que o formulário foi carregado e antes da confirmação
- **THEN** API rejeita a criação ou associação e não persiste vínculo inválido

#### Scenario: Cancelar criação
- **WHEN** usuário pressiona Escape ou clica em Cancelar
- **THEN** formulário fecha sem criar o item

#### Scenario: Card criado com campos padrão
- **WHEN** card é criado pelo formulário rápido com sprint e versão opcionais
- **THEN** item recebe prioridade `MEDIUM`, status `NOT_STARTED`, sem responsável e preserva os vínculos selecionados ou nulos
