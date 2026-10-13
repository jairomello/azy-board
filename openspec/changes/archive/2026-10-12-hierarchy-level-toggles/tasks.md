# Tasks

## 1. Modelo e API do projeto

- [x] 1.1 Adicionar as colunas `hide_modules` e `hide_epics` (boolean, default `false`) em `projects` com migration aditiva e expô-las em `ProjectRecord`/`NewProjectRecord`/`ProjectPatch` (`// [TENANT]`/`// [DB-SWAP]` onde aplicável); validar com `bun run test:migrations` e teste de paridade SQLite/Postgres do schema.
- [x] 1.2 Aceitar e retornar `hideModules`/`hideEpics` em `POST /projects`, `GET /projects/:id` e `PATCH /projects/:id`, rejeitando valores não booleanos; validar com teste de integração cobrindo criação, leitura, edição e RBAC (MEMBER/VIEWER não alteram).

## 2. Recolhimento transacional

- [x] 2.1 Implementar `collapseProjectHierarchy` no unit of work SQLite (módulo único e/ou épico único por módulo, reparentando itens e removendo supérfluos, com eventos e isolamento); validar com teste cobrindo projeto sem módulos, com vários módulos, épico por módulo, preservação de IDs/cards e rollback.
- [x] 2.2 Implementar `collapseProjectHierarchy` no adapter PostgreSQL com eventos equivalentes; validar com teste de paridade SQLite ↔ Postgres (mesmo resultado e mesmos eventos).

## 3. Frontend

- [x] 3.1 Exibir os dois toggles em Configurações do projeto apenas para `HIERARCHICAL`, com confirmação ao ligar (recolhimento destrutivo) e sem confirmação ao desligar; validar com teste de componente cobrindo ligar com confirmação, cancelar e desligar.
- [x] 3.2 Derivar os níveis efetivos no contexto do board e ajustar `BoardLanes` para pular módulo e/ou épico; validar com teste cobrindo board sem módulos, sem épicos e sem ambos.
- [x] 3.3 Ajustar a Tree View para pular os níveis ocultados; validar com teste cobrindo raiz com épicos, com histórias sob módulo e com histórias na raiz.
- [x] 3.4 Condicionar toolbar, filtro de módulos e seções de gestão (módulo/épico) às opções, vinculando criação ao item único; validar com teste cobrindo ausência dos botões/filtro e vínculo automático.

## 4. i18n e documentação

- [x] 4.1 Adicionar as chaves de i18n dos toggles, confirmação e estados em PT-BR, EN e ES; validar com `bun run check:i18n`.
- [x] 4.2 Atualizar a documentação de uso (modos de board/estrutura do projeto) descrevendo as opções, o recolhimento e a reversibilidade; validar com `bun run check:docs`.

## 5. Verificação de integração

- [x] 5.1 Executar `bun run check` (typecheck + lint + testes + build) e corrigir eventuais falhas.
- [x] 5.2 Executar `bun run test:smoke` e confirmar o fluxo web/API com as opções de ocultar módulos/épicos.

## Workflow follow-up

- Encerrar o card T61 (`ff75d8f2-57d9-40b5-9e5c-4e5c6f61ad8f`) com `complete_task` e confirmar no board que o `status` é `DONE`.
- Arquivar a change após a revisão.
