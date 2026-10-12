# Proposal

## Why

O planejamento do projeto (nome, datas, estimativas e escopo) hoje só é
acessível por dentro de Configurações do projeto, um caminho pouco descoberto.
Além disso, não existe visão consolidada dos links e anexos espalhados por todos
os cards: para auditar o que foi compartilhado é preciso abrir card por card.

Board ref: T59 (item `7a99fc9f-43e9-47a2-99ca-b04499630ab6`).

## What Changes

- O nome do projeto no header do board passa a ser um controle interativo que
  abre uma nova **modal de Planejamento do Projeto**; a mesma modal passa a ser
  aberta pelo botão de editar de cada projeto na tela de listagem de projetos
  (substituindo o modal que hoje edita apenas o nome).
- A modal exibe e permite editar os campos já existentes do projeto — nome,
  Data de Início, Data de Fim Previsto, Total de Pontos Previsto, Total de Horas
  Previsto e Escopo (rich text) — respeitando RBAC (ADMIN edita; MEMBER/VIEWER
  veem somente leitura).
- A modal ganha abas de consulta **somente leitura** no escopo do projeto:
  - **Todos os links**: todos os links externos vinculados a qualquer card do
    projeto, sem filtro por item.
  - **Todos os anexos**: todos os anexos vinculados a qualquer card do projeto,
    sem filtro por item (sujeito à configuração de anexos do tenant).
- Novas leituras agregadas no backend: listagem de links e de anexos no escopo
  do projeto, isoladas por tenant/projeto e sujeitas a membership.

## Capabilities

### New Capabilities
- `project-planning-modal`: modal de planejamento do projeto com os campos de
  planejamento e as abas somente leitura de todos os links e todos os anexos do
  projeto, acessível pelo header do board e pela listagem de projetos.

### Modified Capabilities
- `item-links`: nova leitura agregada dos links de todos os itens de um projeto,
  somente leitura, com isolamento por tenant/projeto e membership.
- `file-attachments`: nova leitura agregada dos anexos de todos os itens de um
  projeto, somente leitura, respeitando a habilitação de anexos do tenant e o
  isolamento por tenant/projeto/membership.
- `board-project-name-breadcrumb`: o nome do projeto no header do board deixa de
  ser texto estático e passa a abrir a modal de planejamento do projeto.

## Impact

- **Frontend**: novo componente de modal de planejamento do projeto; reuso dos
  campos de `GeneralSettingsSections` (planejamento) e das áreas de links/anexos;
  alteração do header em `AppShell` e do botão de editar em `ProjectsPage`.
- **Backend**: novas rotas de leitura agregada em `itemLinks` e `attachments` no
  escopo do projeto; consultas de persistência por projeto.
- **Contratos/i18n**: novas chaves de tradução PT-BR/EN/ES; testes de contrato de
  frontend e de API.
- **Anexos**: a aba de anexos do projeto depende da configuração de anexos do
  tenant; quando desabilitada, a aba não exibe conteúdo e a API rejeita a leitura.
