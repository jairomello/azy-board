# Proposal

## Why

Hoje a foto de perfil só pode ser definida pelo próprio usuário em `/account`. Na prática muitos usuários nunca a definem, e cards, comentários e listas ficam dependentes das iniciais do nome — o que piora a identificação em equipes grandes. O administrador já gerencia usuários (grupo, cadastro, redefinição de senha) em `/admin/users`; falta apenas a foto, que é justamente o dado visual que mais falta no sistema.

## What Changes

- A grade de `/admin/users` ganha, à esquerda do nome, uma miniatura circular da foto de cada usuário (ou o avatar por iniciais quando não houver foto).
- Clicar na miniatura abre o mesmo editor de recorte usado em `/account`, permitindo incluir ou substituir a foto de qualquer usuário do tenant ativo.
- Inclusão de ação de remover a foto do usuário, retornando ao avatar por iniciais.
- Novos endpoints administrativos `PUT /api/users/:userId/avatar` e `DELETE /api/users/:userId/avatar`, restritos a `ADMIN`/`ROOT`, com autorização server-side por grupo, escopo de tenant e validação/normalização idênticas ao upload do próprio usuário.
- A alteração reflete no perfil do usuário alvo (cards, comentários, listas e cabeçalho), sem exigir ação do usuário e sem invalidar a sessão dele.
- Textos novos nos três idiomas (pt-BR, en, es) no namespace `common`.

Sem mudança de schema de banco: `users.avatar_url` e o `AvatarStore` já existentes passam a ser gravados pelo administrador para outro `user_id` do mesmo tenant.

## Capabilities

### New Capabilities

Nenhuma capability nova. A evolução é de comportamento já coberto por capabilities existentes.

### Modified Capabilities

- `user-permissions`: a Administração de usuários passa a permitir que Admin/Root incluam, alterem e removam a foto de perfil de qualquer usuário do tenant ativo, com a coluna de miniatura na listagem e as regras de acesso correspondentes.
- `auth`: a operação de foto de perfil deixa de ser exclusiva do dono da conta e passa a admitir atuação de Admin/Root sobre outro usuário do mesmo tenant, mantendo validação, normalização, armazenamento isolado por tenant e serving autenticado.

## Impact

- API: `apps/api/src/routes/users.ts` (novas rotas administrativas de avatar, reuso de `avatarStore`, `normalizeAvatar` e `persistence.identity.updateAvatarUrl`); testes de avatar em `apps/api/src/avatar.test.ts`/`integration.test.ts`.
- Web: `apps/web/src/pages/AdminUsersPage.tsx` (coluna de miniatura, fluxo de editor, remoção e estados de envio), reuso de `AvatarCropDialog`, `UserAvatar`, `lib/avatarImage` e `api.upload`; cache de `adminUsers` invalidado após a operação.
- i18n: `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json` (chaves `adminUsers.*`).
- Segurança: RBAC `ADMIN`/`ROOT`, filtro obrigatório de `tenant_id` e `user_id` do alvo (anti-IDOR), log de auditoria da ação administrativa.
- Nenhuma dependência nova, nenhuma migração de banco e nenhuma alteração em contratos MCP.
