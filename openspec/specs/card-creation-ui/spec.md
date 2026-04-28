## MODIFIED Requirements

### Requirement: Botão de criação de card por coluna envia para `/items`
O sistema SHALL exibir um botão "+" no rodapé de cada coluna do board para adicionar novo card. O formulário rápido envia para `POST /projects/:id/items` com o `type` selecionado.

#### Scenario: Abrir formulário rápido de criação
- **WHEN** usuário clica no botão "+" de uma coluna
- **THEN** formulário compacto é exibido inline na coluna com campo de título, seletor de tipo (Task / Bug) e botões "Adicionar" e "Cancelar"

#### Scenario: Criar card TASK pelo formulário rápido
- **WHEN** usuário digita o título, mantém tipo `Task` e pressiona Enter ou clica em "Adicionar"
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = TASK` na coluna correspondente, formulário fecha e card aparece em tempo real

#### Scenario: Criar card BUG pelo formulário rápido
- **WHEN** usuário digita o título, seleciona tipo `Bug` e confirma
- **THEN** sistema cria o item via `POST /projects/:id/items` com `type = BUG` na coluna correspondente

#### Scenario: Cancelar criação
- **WHEN** usuário pressiona Escape ou clica em "Cancelar"
- **THEN** formulário fecha sem criar o item

#### Scenario: Card criado com campos padrão
- **WHEN** card é criado pelo formulário rápido (somente título e tipo)
- **THEN** item recebe prioridade `MEDIUM`, status `NOT_STARTED` e sem responsável; demais campos ficam vazios para edição posterior na ItemModal
