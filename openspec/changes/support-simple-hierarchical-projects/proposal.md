## Why

O board atual foi desenhado para projetos que precisam organizar trabalho por módulo, épico e história. Para projetos menores, essa estrutura adiciona navegação e ruído visual desnecessários; é necessário oferecer um board simples, único, mantendo o acompanhamento direto das tarefas em um Kanban.

## What Changes

- Permitir escolher o tipo de board (`HIERARCHICAL` ou `SIMPLE`) ao criar um projeto, com `HIERARCHICAL` como comportamento atual padrão.
- Exibir no modo simples um único fluxo Kanban, sem a navegação visual por módulos e épicos, contendo uma história fixa e os cards de tarefas associados a ela.
- Permitir alterar o tipo de board nas configurações do projeto.
- Ao converter um projeto hierárquico para simples, executar uma migração transacional: remover módulos e épicos, preservar os cards de tarefas/bugs e movê-los para a história fixa, sem apagar esses cards.
- Ao converter um projeto simples para hierárquico, provisionar a estrutura mínima necessária sem perder os cards existentes e definir uma regra explícita para a localização deles.
- Adaptar criação de cards, filtros, breadcrumbs, árvore, progresso, pontuação, drag-and-drop e atualizações realtime para respeitar o tipo de board.
- Manter permissões, multi-tenancy e compatibilidade com projetos existentes.

## Capabilities

### New Capabilities

- `project-board-modes`: contrato do modo de board simples e hierárquico, seleção no ciclo de vida do projeto e migração entre modos.

### Modified Capabilities

- `project-management`: criação e configuração do projeto passam a controlar o tipo de board.
- `board-management`: a composição e os controles do board passam a variar conforme o modo do projeto.
- `task-hierarchy`: a hierarquia, breadcrumbs e agregações deixam de ser obrigatórias no modo simples, mantendo a regra de cards de tarefas.

## Impact

- Schema e migração do banco para armazenar o modo do projeto e identificar a história fixa do modo simples.
- API de projetos, itens, módulos e configuração, incluindo validação, autorização e migração transacional.
- `ProjectsPage`, `SettingsPage`, `BoardPage` e componentes de swimlanes, filtros, árvore e cards.
- Consultas de listagem, criação/movimentação de itens, breadcrumbs, progresso/pontos e sincronização realtime.
- Integrações MCP que criam e consultam itens, para não assumirem a existência de módulo ou épico em projetos simples.
- Testes de criação, alternância nos dois sentidos, preservação de cards, isolamento entre tenants e regressão do modo hierárquico.
