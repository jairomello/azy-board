## 1. Contratos compartilhados

- [x] 1.1 Definir em `packages/ui-contracts` o `ICON_CATALOG` (nomes kebab-case, 40–60 ícones lucide), o tipo `IconName`, `DEFAULT_PROJECT_ICON`, `DEFAULT_ITEM_ICON` e `ICON_COLORS` (10 hex da paleta atual)
- [x] 1.2 Adicionar `icon?: string | null` e `color?: string | null` à interface `Card` e ao mapeamento `toCard` em `packages/ui-contracts`
- [x] 1.3 Garantir a reexportação dos novos contratos pelo barrel `packages/types/src/index.ts`
- [x] 1.4 Criar `apps/web/src/lib/iconCatalog.ts` com o mapa `nome → LucideIcon` cobrindo **todo** o `ICON_CATALOG` (e helper de resolução com default)

## 2. Dados e migrações

- [x] 2.1 Adicionar `icon` (text nullable) e `color` (text nullable) em `projects` e `items` no schema SQLite (`apps/api/src/db/schema.ts`)
- [x] 2.2 Espelhar as colunas no schema PostgreSQL (`apps/api/src/db/postgres/schema.ts`) e marcar pontos de troca de driver com `// [DB-SWAP]`
- [x] 2.3 Gerar a migração SQLite aditiva (`apps/api/src/db/migrations/0038_*.sql`) e criar a migração PG equivalente (`apps/api/src/db/postgres/migrations/0009_*.sql`), sem backfill
- [x] 2.4 Atualizar as listas de migrações fixadas em `apps/api/src/db/postgres/migrations.test.ts` e `parity.test.ts`
- [x] 2.5 Adicionar `icon`/`color` a `ProjectRecord` e `ItemRecord` em `apps/api/src/persistence/models.ts`
- [x] 2.6 Mapear `icon`/`color` nos adapters SQLite (`mapProject`/`mapItem` e INSERT/UPDATE), preservando `// [TENANT]` e `// [DB-SWAP]` existentes
- [x] 2.7 Mapear `icon`/`color` nos adapters PostgreSQL (map, INSERT e field map do UPDATE)
- [x] 2.8 Estender `migration.test.ts` para assertar as novas colunas na cadeia completa (SQLite) e rodar `bun run test:migrations`

## 3. Validação e rotas da API

- [x] 3.1 Adicionar `icon` (refine contra `ICON_CATALOG`) e `color` (enum `ICON_COLORS`) opcionais/nullable em `projectFields`, `updateProjectSchema` e demais schemas `.strict()` de `apps/api/src/validation.ts`
- [x] 3.2 Adicionar `icon`/`color` em `createItemSchema` e `updateItemSchema` com a mesma validação
- [x] 3.3 Incluir `icon`/`color` no objeto de criação e no `ProjectPatch` das rotas `POST /projects` e `PATCH /projects/:id`
- [x] 3.4 Incluir `icon`/`color` no payload de criação de item e adicionar ambos a `writableFields` no `PATCH /projects/:id/items/:itemId`
- [x] 3.5 Incluir `icon`/`color` na projeção do projeto em `GET /projects/:id/board`
- [x] 3.6 Cobrir em `apps/api/src/integration.test.ts`: criar/editar projeto e item com valores válidos, `null` para limpar e 400 para valores fora do catálogo/paleta

## 4. MCP / tool-registry

- [x] 4.1 Adicionar `icon`/`color` às listas de campos de `create_project`, `update_project`, `create_task`, `update_item` e `update_items` em `packages/tool-registry/src/fields.ts`
- [x] 4.2 Adicionar `icon`/`color` ao enum de `field` de `update_item`/`update_items` e a `allowedFields`/`clearableFields` em `packages/tool-registry/src/validation.ts`
- [x] 4.3 Incluir `icon`/`color` em `PROJECTION_FIELDS` e no `ProjectSummary` de `apps/mcp/src/tools.ts`
- [x] 4.4 Atualizar os testes de contrato/catálogo MCP (`registry.test.ts`, `optional-fields.test.ts`, `tools.test.ts`) e rodar `bun run test:mcp-catalog`

## 5. Frontend — seletor

- [x] 5.1 Criar o componente `IconPicker` (grade com busca simples), no padrão de dropdown com portal do `TagSelector`, sem adicionar Radix/`cmdk`
- [x] 5.2 Criar swatches de cor reutilizando `ICON_COLORS` (extrair componente compartilhado a partir da paleta do `TagSelector`)
- [x] 5.3 Adicionar as chaves de i18n do seletor e da aparência nos 3 locales (`pt-BR`, `en`, `es`) e validar com `bun run check:i18n`

## 6. Frontend — projeto

- [x] 6.1 Adicionar `icon`/`color` ao estado e ao payload de criação em `apps/web/src/pages/ProjectsPage.tsx` (modal de novo projeto)
- [x] 6.2 Adicionar edição de aparência nas configurações do projeto (`features/project-settings/model/types.ts`, seed em `useProjectSettingsData.ts` e PATCH em `ProjectSettingsScreen.tsx`/`GeneralSettingsSections.tsx`)
- [x] 6.3 Exibir o ícone do projeto em `AppShell` (sidebar e cabeçalho), no breadcrumb e na lista de `ProjectsPage` (substituindo o avatar de letra quando houver ícone)

## 7. Frontend — item

- [x] 7.1 Adicionar `icon`/`color` a `CardData`/`FullItemData` e ao objeto enviado por `handleSave`/`handleModalSave`
- [x] 7.2 Exibir o ícone do item em `KanbanCard` (antes do título) e no cabeçalho de `ItemModal`/`ItemDetailHeader`, respeitando a cor
- [x] 7.3 Incluir o seletor de aparência (ícone + cor) no modal do item, integrado ao salvamento existente

## 8. Testes e guardas finais

- [x] 8.1 Criar teste de componente do `IconPicker`/swatches com `../test/setup`, marcando `[CONTRATO-ESTRUTURAL]` caso leia código-fonte
- [x] 8.2 Criar teste de contrato garantindo que todo nome de `ICON_CATALOG` tem mapeamento em `apps/web/src/lib/iconCatalog.ts` (com `[CONTRATO-ESTRUTURAL]`)
- [x] 8.3 Rodar `bun run check`, `bun run test:migrations`, `bun run check:i18n`, `bun run check:frontend-tests` e `bun run check:bundle`; se o bundle estourar, adicionar chunk dedicado ao catálogo em `vite.config.ts`
- [x] 8.4 Após implementação, executar `bun run test:smoke`, registrar o `Board ref` nos artefatos e fechar o card T14 com `complete_task`, confirmando no board que o status é `DONE`
