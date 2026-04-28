## ADDED Requirements

### Requirement: Botão de criação de card por coluna
O sistema SHALL exibir um botão "+" no rodapé de cada coluna do board para adicionar novo card àquela coluna.

#### Scenario: Abrir formulário rápido de criação
- **WHEN** usuário clica no botão "+" de uma coluna
- **THEN** um formulário compacto é exibido inline na coluna com campo de título e botões "Adicionar" e "Cancelar"

#### Scenario: Criar card pelo formulário rápido
- **WHEN** usuário digita o título e pressiona Enter ou clica em "Adicionar"
- **THEN** sistema cria o card via API na coluna correspondente, o formulário fecha e o card aparece no topo da coluna em tempo real

#### Scenario: Cancelar criação
- **WHEN** usuário pressiona Escape ou clica em "Cancelar"
- **THEN** formulário fecha sem criar o card

#### Scenario: Card criado com campos padrão
- **WHEN** card é criado pelo formulário rápido (somente título)
- **THEN** card recebe prioridade MEDIUM, status NOT_STARTED e sem responsável; demais campos ficam vazios para edição posterior
