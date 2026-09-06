## Purpose

Definir os requisitos da capacidade card creation ui.

## Requirements

### Requirement: Botão de criação de card por coluna envia para `/items`
O sistema SHALL exibir um botão "+" no rodapé de cada coluna do board para adicionar novo card. O formulário rápido SHALL conter título, tipo (`TASK`/`BUG`), sprint opcional e versão opcional, enviando os dados para `POST /projects/:id/items`. Sprint SHALL listar somente `PROPOSED` ou `OPEN`.

#### Scenario: Abrir formulário rápido de criação
- **WHEN** usuário clica no botão "+" de uma coluna
- **THEN** formulário compacto é exibido inline na coluna com título, tipo, sprint opcional, versão opcional e ações Adicionar/Cancelar

#### Scenario: Formulário sem sprints cadastradas
- **WHEN** usuário abre o formulário em projeto sem sprints
- **THEN** campo Sprint permanece visível com `Sem sprint` e `Nenhuma sprint cadastrada`

#### Scenario: Criar card TASK pelo formulário rápido
- **WHEN** usuário digita o título, mantém tipo `Task` e pressiona Enter ou clica em "Adicionar"
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = TASK` na coluna correspondente, formulário fecha e card aparece em tempo real

#### Scenario: Criar card BUG pelo formulário rápido
- **WHEN** usuário digita o título, seleciona tipo `Bug` e confirma
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = BUG` na coluna correspondente

#### Scenario: Associar sprint ou versão na criação rápida
- **WHEN** usuário seleciona sprint elegível e/ou versão do projeto e confirma
- **THEN** sistema cria o item preservando os vínculos selecionados; sem seleção, os vínculos ficam nulos

#### Scenario: Sprint fechada durante a criação
- **WHEN** uma sprint é fechada antes da confirmação
- **THEN** API rejeita a criação ou associação e não persiste vínculo inválido

#### Scenario: Cancelar criação
- **WHEN** usuário pressiona Escape ou clica em "Cancelar"
- **THEN** formulário fecha sem criar o item

#### Scenario: Card criado com campos padrão
- **WHEN** card é criado pelo formulário rápido (somente título e tipo)
- **THEN** item recebe prioridade `MEDIUM`, status `NOT_STARTED` e sem responsável; demais campos ficam vazios para edição posterior na ItemModal

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
