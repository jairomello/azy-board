## Why

O usuário não consegue alterar seu nome de exibição em `/account`: o nome aparece somente leitura em `ProfilePhotoSection` e `PATCH /api/users/me` rejeita `name` (allowlist `theme|lightShellTheme|language|autoThemeByTime`). O card T54 pede permitir trocar o nome exibido (ex.: "Administrador" → "Jairo Silva"), deixando explícito que o **login (e-mail) não deve ser alterável**. O nome alimenta o avatar por iniciais e o `assignee`/`author` dos cards, então hoje não há como corrigir um nome incorreto sem editar o banco.

## What Changes

- **Nome editável na página de conta**: a seção de perfil de `/account` passa a ter um campo de texto com o nome de exibição, botão de salvar, estados de carregando/sucesso/erro e feedback acessível por teclado.
- **API de atualização de nome**: `PATCH /api/users/me` passa a aceitar `name` (trim, 1–200 caracteres) junto das preferências já suportadas, sempre escopado ao usuário autenticado e ao tenant (anti-IDOR). O e-mail permanece imutável e nunca é aceito nesse fluxo.
- **Persistência dedicada**: nova operação de porta `updateUserName` (ou patch de perfil equivalente) implementada nos adaptadores SQLite e PostgreSQL, com paridade e sem migration (o campo `users.name` já existe e não é único).
- **Efeito observável**: após salvar, o nome é atualizado no topo da página, no dropdown do avatar, nas iniciais do avatar e nos cards/comentários que fazem join ao vivo do usuário — sem novo login, pois o nome não faz parte do JWT.
- **i18n**: rótulos, estados e mensagens de erro do campo de nome nos três idiomas (pt-BR, en, es) no namespace `settings`, respeitando a paridade do `check:i18n`.

## Capabilities

### New Capabilities
<!-- Nenhuma: a edição de nome de exibição pertence à área de conta já existente. -->

### Modified Capabilities
- `account-settings`: a página de conta passa a permitir **editar o nome de exibição** (não apenas exibi-lo), com validação, persistência e feedback; o e-mail permanece somente leitura.

## Impact

- **API:** `apps/api/src/routes/users.ts` (`PATCH /users/me`: allowlist e resposta) e `apps/api/src/validation.ts` (schema que aceita `name` com a mesma regra de `createUserSchema`).
- **Persistência:** `apps/api/src/persistence/ports.ts` (operação de atualização de nome) e os adaptadores `apps/api/src/db/sqlite/adapter.ts` e `apps/api/src/db/postgres/adapter.ts`.
- **Web:** `apps/web/src/pages/AccountPage.tsx` (ou seção de perfil), `apps/web/src/components/ProfilePhotoSection.tsx`, `apps/web/src/contexts/AuthContext.tsx` (atualização do estado local do usuário) e `apps/web/src/i18n/locales/*/settings.json`.
- **Banco:** nenhuma migration; `users.name` já existe em SQLite e PostgreSQL e não possui constraint de unicidade.
- **Contratos:** `GET /auth/me`, login e joins de usuário em itens continuam devolvendo `name`; nenhuma mudança de contrato incompatível. O JWT permanece sem `name`, portanto a sessão não é invalidada.
- **Rastreabilidade:** Board ref: 99fe4f39-9a74-47b9-bbf7-ed3e2ffe5193 (card T54).
- **Fora de escopo:** alterar e-mail/login, alterar o nome de outro usuário (admin), histórico de nomes, apelidos/handles, unicidade de nome, upload/edição de avatar.
