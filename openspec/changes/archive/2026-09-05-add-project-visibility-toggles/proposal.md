## Why

Hoje a listagem de projetos é binária: membros veem apenas os projetos nos quais têm membership, e administradores veem **todos** os projetos do tenant, sem exceção. Isso não atende dois cenários reais de uso: (1) projetos sensíveis que, mesmo existindo no workspace, só devem ser visíveis para quem efetivamente participa deles — inclusive para administradores, que hoje enxergam tudo; e (2) projetos encerrados ou de uso eventual que poluem a tela inicial e que o usuário gostaria de tirar da listagem sem precisar excluí-los, semelhante ao comportamento de arquivos ocultos em um gerenciador de arquivos.

## What Changes

- Adiciona dois sinalizadores de visibilidade ao projeto, com defaults permissivos (comportamento atual preservado para projetos existentes):
  - **Restrito** (`isRestricted`, default `false`): quando ativo, o projeto só aparece na listagem para usuários vinculados a ele como gerente (`projects.managerUserId`) ou como membro da equipe (`memberships`). Administradores e Root **perdem** o bypass global de escopo para projetos restritos sem vínculo.
  - **Oculto** (`isHidden`, default `false`): quando ativo, o projeto não aparece nas listagens por padrão. Para enxergá-lo, o usuário precisa ligar a preferência "mostrar projetos ocultos".
- Adiciona a preferência de sessão **"mostrar projetos ocultos"**, disponível no dropdown do avatar e na seção de preferências da página `/account`. Ela vale apenas para a sessão atual: é reiniciada para "não mostrar" em todo login, e nunca é persistida em banco nem em `localStorage`.
- Expõe os dois sinalizadores no modal de criação de projeto e em uma nova seção de visibilidade nas configurações do projeto, permitindo alterá-los depois da criação.
- **BREAKING (contrato)**: `GET /api/projects` passa a aplicar filtro de visibilidade e ganha o parâmetro de consulta `includeHidden`. Projetos ocultos deixam de ser retornados por padrão e projetos restritos deixam de ser retornados para administradores sem vínculo. Clientes que contavam com "admin vê tudo" (incluindo agentes MCP/`list_projects`) passam a receber um subconjunto.

## Capabilities

### New Capabilities
- `project-visibility`: sinalizadores "Restrito" e "Oculto" do projeto, regras de filtragem da listagem, parâmetro `includeHidden` da API e a preferência de sessão "mostrar projetos ocultos".

### Modified Capabilities
- `project-management`: o requirement "Listar projetos do usuário" passa a considerar visibilidade, e "Criar projeto" passa a aceitar os sinalizadores.
- `user-permissions`: o requirement "Escopo de projetos por grupo" deixa de garantir que administradores visualizem **todos** os projetos do tenant — passa a ser todos os projetos **não restritos** mais os restritos com vínculo.
- `account-settings`: o dropdown do avatar e a página `/account` passam a expor a preferência de sessão "mostrar projetos ocultos".

## Impact

**Banco de dados**
- `apps/api/src/db/schema.ts`: duas colunas booleanas com default em `projects` (`is_restricted`, `is_hidden`).
- Nova migração aditiva `apps/api/src/db/migrations/0018_*.sql` + entrada em `meta/_journal.json`.

**API (`apps/api/src/routes/projects.ts`)**
- `GET /projects`: filtro de restrito aplicado nos dois ramos da consulta (admin e membro) e filtro de oculto condicionado a `includeHidden`.
- `POST /projects` e `PATCH /projects/:id`: aceitam e persistem `isRestricted` / `isHidden`.

**Frontend (`apps/web`)**
- `pages/ProjectsPage.tsx`: tipo `Project`, modal de criação/edição, envio de `includeHidden` no fetch e filtro local de projetos ocultos.
- `pages/SettingsPage.tsx`: nova seção "Visibilidade do projeto" com os dois toggles.
- `contexts/AuthContext.tsx`: estado de sessão da preferência, reiniciado em `login()` e `logout()`.
- `components/ProfileDropdown.tsx` e `pages/AccountPage.tsx`: controles sincronizados da preferência.
- `i18n/locales/{pt-BR,en,es}/*.json`: novas chaves.

**Tipos compartilhados**
- `packages/types/src/index.ts`: tipos dos sinalizadores de visibilidade.

**Agentes / MCP**
- `list_projects` e demais tools do `apps/mcp` herdam automaticamente o novo escopo por reutilizarem `GET /projects` (a spec `mcp-permissions` já exige que agentes obedeçam ao escopo do Owner — sem mudança de requirement).

**Testes**
- `apps/api/src/integration.test.ts`: cenários de restrito/oculto para membro, admin sem vínculo, gerente e isolamento entre tenants.
- Novo contrato de UI em `apps/web/src/` no padrão `*contract.test.ts`.
