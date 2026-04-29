## 1. Banco de dados — Migrations

- [x] 1.\1 Criar migration: tabela `project_versions` com campos `id`, `tenant_id`, `project_id`, `name`, `release_date`, `description`, `status` (TEXT CHECK: PLANNED/IN_DEV/RELEASED/CANCELLED), `position`, `created_at` — incluir índices em `(project_id, tenant_id)` // [TENANT] // [DB-SWAP] TEXT CHECK vira ENUM em PostgreSQL
- [x] 1.\1 Criar migration: `ALTER TABLE items ADD COLUMN version_id TEXT REFERENCES project_versions(id) ON DELETE SET NULL`
- [x] 1.\1 Atualizar schema Drizzle ORM: tabela `projectVersions`, campo `versionId` em `items`, relações `version` em `itemsRelations` e `items` em `projectVersionsRelations`
- [x] 1.\1 Atualizar `_journal.json` para incluir a nova migration e executar `bun run src/db/migrate.ts`

## 2. Backend — Endpoint DELETE de módulo

- [x] 2.1 Criar `DELETE /projects/:id/modules/:moduleId` em `projects.ts` com RBAC ADMIN // [TENANT] Anti-IDOR verificar ownership do módulo
- [x] 2.2 Tratar body `{ targetModuleId? }`: se informado, atualizar `moduleId` dos épicos do módulo para `targetModuleId` antes de excluir
- [x] 2.3 Tratar body `{ cascade: true }`: excluir o módulo e todos os épicos (e descendentes via BFS) em cascata
- [x] 2.4 Sem body e com épicos vinculados: retornar 409 `{ error, epicCount }`

## 3. Backend — API de versões

- [x] 3.1 Criar `GET /projects/:id/versions` — lista versões ordenadas por `position`, filtra por `tenant_id` // [TENANT]
- [x] 3.2 Criar `POST /projects/:id/versions` com RBAC ADMIN — persiste com `tenant_id` do middleware // [TENANT]
- [x] 3.3 Criar `PATCH /projects/:id/versions/:versionId` com RBAC ADMIN — atualiza campos fornecidos // [TENANT] Anti-IDOR
- [x] 3.4 Criar `DELETE /projects/:id/versions/:versionId` com RBAC ADMIN — define `version_id = null` nos itens vinculados antes de excluir // [TENANT]
- [x] 3.5 Criar `GET /projects/:id/versions/:versionId/items?page&limit` — lista itens paginados com `version_id` igual, inclui título, tipo, status, responsável // [TENANT]

## 4. Backend — Campo versionId nos itens

- [x] 4.1 Atualizar `POST /projects/:projectId/items` para aceitar e persistir `versionId` opcional no body
- [x] 4.2 Atualizar `PATCH /projects/:projectId/items/:itemId` para aceitar e persistir `versionId` opcional (permite null para remover)
- [x] 4.3 Incluir `version: { id, name, status }` no retorno dos endpoints `GET /items` e `GET /items/:id` via join com `project_versions`

## 5. Frontend — Seção Módulos em Settings

- [x] 5.1 Adicionar estado `modules` e fetch `GET /projects/:id/modules` no `SettingsPage.tsx`
- [x] 5.2 Renderizar lista de módulos com nome, contagem de épicos e botões Editar/Excluir (visíveis apenas para ADMIN)
- [x] 5.3 Formulário inline de criação de módulo (campo nome + botão "Criar") — chama `POST /projects/:id/modules`
- [x] 5.4 Edição inline de nome do módulo ao clicar em "Editar" — chama `PATCH /projects/:id/modules/:moduleId`
- [x] 5.5 Exclusão de módulo sem épicos: confirmação simples + chama `DELETE /projects/:id/modules/:moduleId`
- [x] 5.6 Exclusão de módulo com épicos: modal de confirmação listando contagem de épicos e permitindo escolher módulo destino OU excluir em cascata

## 6. Frontend — Seção Versões em Settings

- [x] 6.1 Adicionar estado `versions` e fetch `GET /projects/:id/versions` no `SettingsPage.tsx`
- [x] 6.2 Renderizar lista de versões com: nome, badge de situação colorido, data de lançamento formatada, ações (Ver, Editar, Excluir) para ADMIN
- [x] 6.3 Formulário inline de criação: campos nome (obrigatório), data, descrição, situação — chama `POST /projects/:id/versions`
- [x] 6.4 Excluir versão: confirmação simples + chama `DELETE /projects/:id/versions/:versionId`

## 7. Frontend — VersionDetailModal

- [x] 7.1 Criar componente `VersionDetailModal` com props: `version`, `projectId`, `mode` ('view' | 'edit'), `onClose`, `onSave`
- [x] 7.2 Em modo `edit`: renderizar campos editáveis (nome, data, descrição, situação) + botão Salvar
- [x] 7.3 Em modo `view`: renderizar campos somente leitura
- [x] 7.4 Seção "Itens vinculados": lista paginada de itens buscados via `GET /projects/:id/versions/:versionId/items` com ícone de tipo, título, badge de status e avatar do responsável
- [x] 7.5 Botão "Carregar mais" quando total > 20
- [x] 7.6 Integrar `VersionDetailModal` no `SettingsPage`: clicar em "Ver" → mode view; clicar em "Editar" → mode edit

## 8. Frontend — Campo Versão nas modais de itens

- [x] 8.1 Adicionar prop `projectVersions: Version[]` à `ItemModal` e ao `FullItemData` (campo opcional `versionId`)
- [x] 8.2 Renderizar select "Versão" na `ItemModal` quando `projectVersions.length > 0`, com opção "Sem versão" e as versões do projeto; incluir `versionId` no `handleSave`
- [x] 8.3 Adicionar prop `projectVersions` à `EpicModal` e `EpicData`; renderizar select "Versão" quando há versões disponíveis
- [x] 8.4 Adicionar prop `projectVersions` à `StoryModal` e `StoryData`; renderizar select "Versão" quando há versões disponíveis
- [x] 8.5 Em `BoardPage.tsx`: buscar `GET /projects/:id/versions` no `useEffect` de carregamento e passar `projectVersions` para `ItemModal`, `EpicModal` e `StoryModal`

## 9. Internacionalização (i18n)

- [x] 9.1 Adicionar chaves PT-BR em `settings.json`: "Módulos", "Nenhum módulo", "Criar módulo", "Versões", "Nova versão", "Nenhuma versão", "Situação", "Data de lançamento", "Planejada", "Em desenvolvimento", "Lançada", "Cancelada", "Ver versão", "Itens desta versão", "Nenhum item vinculado"
- [x] 9.2 Adicionar equivalentes em EN e ES
