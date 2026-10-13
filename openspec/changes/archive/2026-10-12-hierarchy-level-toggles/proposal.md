# Proposal

## Why

Projetos `HIERARCHICAL` hoje sempre exibem os quatro níveis (Módulo → Épico →
História → Card). Para projetos de complexidade intermediária, essa estrutura é
pesada: o usuário não precisa de múltiplos módulos nem de épicos, mas também não
quer o modo `SIMPLE` (que colapsa tudo numa única STORY fixa). Falta um meio-termo
que simplifique a exibição sem perder o modelo hierárquico.

Board ref: T61 (item `ff75d8f2-57d9-40b5-9e5c-4e5c6f61ad8f`).

## What Changes

- Adiciona duas opções independentes no projeto `HIERARCHICAL`, configuráveis em
  Configurações do projeto:
  - **Não exibir módulos** — recolhe tudo a um **módulo único** (criado
    automaticamente se não existir) e vincula os épicos/histórias a ele.
  - **Não exibir épicos** — recolhe tudo a um **épico único** por módulo (ou sob
    o módulo único, quando módulos também estão ocultos) e vincula as histórias a
    ele.
- Ao ligar uma opção com módulos/épicos existentes, eles são **recolhidos/fundidos**
  no item único (histórias são reparentadas; módulos/épicos supérfluos são
  removidos), preservando cards, IDs, conteúdo e relações.
- Com as opções ligadas, o **board Kanban** e a **Tree View** pulam os níveis
  ocultados: módulo e/ou épico deixam de aparecer, indo do projeto direto para as
  histórias e tasks. Os controles de criação e as seções correspondentes
  (`+ Módulo`, `+ Novo Épico`, seção "Módulos", filtro de módulos) deixam de ser
  exibidos.
- As opções são **reversíveis**: desligá-las volta a exibir o nível; o item único
  permanece e pode ser renomeado, e o usuário pode criar novos módulos/épicos.
- As opções só se aplicam a projetos `HIERARCHICAL`; projetos `SIMPLE` mantêm o
  comportamento atual.

## Capabilities

### New Capabilities
- `hierarchy-level-toggles`: as duas opções independentes de ocultar módulos e
  épicos em projetos hierárquicos — semântica de recolhimento, reversibilidade,
  persistência e efeitos na configuração do projeto.

### Modified Capabilities
- `project-board-modes`: a apresentação do board hierárquico passa a pular os
  níveis ocultados (módulo e/ou épico).
- `tree-view`: a árvore passa a pular os níveis ocultados.
- `module-management`: com módulos ocultos, o projeto opera com um módulo único e
  os controles de módulo deixam de ser exibidos.
- `epic-story-ui`: com épicos ocultos, o nível de épico deixa de ser exibido e os
  controles de criação de épico somem.
- `project-management`: o projeto passa a aceitar e retornar as duas opções.

## Impact

- **Backend**: novas colunas booleanas em `projects` (migration); campos em
  `GET/PATCH /projects/:id` e `POST /projects`; serviço transacional de
  recolhimento (módulo/épico único) reaproveitando o padrão de
  `convertProjectBoardMode`; preservação de cards/IDs/conteúdo.
- **Frontend**: seção de Configurações com os dois toggles; flags no contexto do
  board; renderização do Kanban e da Tree View pulando níveis; toolbar e seções
  condicionais.
- **i18n**: novas chaves PT-BR/EN/ES.
- **Migrations**: nova migration aditiva (colunas booleanas com default `false`),
  com teste de paridade e de idempotência.
