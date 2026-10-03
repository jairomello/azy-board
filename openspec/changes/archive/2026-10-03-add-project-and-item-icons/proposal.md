## Why

Hoje projetos e itens só se diferenciam por texto, o que torna lento reconhecer um projeto ou um card em listas, sidebar e no Kanban conforme o workspace cresce. Usuários pediram um pacote de ícones disponível no produto e a opção de escolher um ícone — e, se possível, uma cor — para representar projeto e item, sempre com um valor padrão quando não houver personalização.

Board ref: `12b44609-2002-413c-b8a3-a2db35bf9cd8` (card T14).

## What Changes

- Adotar oficialmente o **lucide-react** (licença ISC, já dependência do web) como pacote de ícones open-source do produto, sem novas dependências de risco de licenciamento.
- Expor um **catálogo curado e versionado** de nomes de ícones (kebab-case) compartilhado entre web, API e MCP, com limites de uso para não estourar o orçamento de bundle.
- Adicionar os campos opcionais e nullable `icon` (nome do ícone no catálogo) e `color` (hex de uma paleta fixa) em `projects` e `items`.
- Definir **ícone e cor default** de projeto e de item quando o usuário não personalizar (o default não é persistido; é aplicado na apresentação).
- Permitir escolher ícone e cor ao **criar/editar projeto** (ProjectsPage) e na **tela de configurações do projeto**.
- Permitir escolher ícone e cor do **item/card** no modal de item (TASK/BUG, e de forma consistente em STORY/EPIC via header compartilhado).
- **Exibir** o ícone do projeto na sidebar/cabeçalho, no breadcrumb e nos cards da lista de projetos; exibir o ícone do card no KanbanCard e no cabeçalho do modal.
- Validar `icon` (pertence ao catálogo) e `color` (pertence à paleta) no backend; propagar os campos nos contratos de API, na projeção do board e nas tools MCP.
- Criar migrações **SQLite e PostgreSQL** (aditivas, sem perda de dados) e atualizar tipos compartilhados e i18n (PT-BR/EN/ES).
- Sem **BREAKING**: todos os campos são opcionais; projetos e itens existentes permanecem válidos e recebem o default visual.

## Capabilities

### New Capabilities
- `entity-icons`: catálogo de ícones open-source e personalização de ícone e cor para projetos e itens, incluindo defaults, validação, persistência e apresentação consistente em web, API e MCP.

### Modified Capabilities
- `project-management`: criar/editar projeto passa a aceitar e retornar `icon` e `color` opcionais.
- `card-management`: criar/editar item/card passa a aceitar, retornar e exibir `icon` e `color` opcionais.

## Impact

- **Dados/DB**: `apps/api/src/db/schema.ts`, `apps/api/src/db/postgres/schema.ts`; novas migrações em `apps/api/src/db/migrations/` e `apps/api/src/db/postgres/migrations/`.
- **API**: `apps/api/src/validation.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/items.ts`, adapters SQLite/PG e `apps/api/src/persistence/models.ts`.
- **MCP/tool-registry**: `packages/tool-registry/src/fields.ts`, enum de `field`, `packages/tool-registry/src/validation.ts` e `apps/mcp/src/tools.ts`.
- **Contratos compartilhados**: `packages/ui-contracts` (catálogo de ícones, paleta e campos em `Card`/`toCard`) e `packages/domain` quando aplicável.
- **Web**: `ProjectsPage.tsx`, `ProjectSettingsScreen.tsx`/`GeneralSettingsSections.tsx`, `AppShell.tsx`, `KanbanCard.tsx`, `ItemModal.tsx`, `ItemDetailHeader.tsx`, novo componente de galeria/seletor de ícone e cor; arquivos de i18n.
- **Testes e guardas**: `migration.test.ts`/`integrity.test.ts`/paridade PG, `integration.test.ts`, testes MCP/tool-registry, `check:i18n`, `check:frontend-tests` e `check:bundle`.
