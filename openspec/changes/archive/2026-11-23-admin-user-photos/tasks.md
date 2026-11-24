# Tasks

## 1. API — gravação de foto com alvo explícito

- [x] 1.1 Extrair em `apps/api/src/routes/users.ts` uma função interna de gravação de foto que recebe `targetUserId` (busca do alvo no tenant com 404, `normalizeAvatar`, `avatarStore.save`, `updateAvatarUrl`, comentário `// [TENANT]`) e fazer `PUT /users/me/avatar` usá-la com `ctx.userId`, verificando que `apps/api/src/avatar.test.ts` continua verde (`bun test apps/api/src/avatar.test.ts`).
- [x] 1.2 Adicionar `PUT /users/:userId/avatar` protegido por `requireGlobalGroup('ADMIN')`, registrado depois de `/me/avatar`, devolvendo `{ user: { id, name, email, avatarUrl, globalGroup } }` e mantendo os erros 400/413/415/404 do contrato atual — verificar com teste novo de upload administrativo (200 + `avatarUrl` versionada).
- [x] 1.3 Adicionar `DELETE /users/:userId/avatar` protegido por `requireGlobalGroup('ADMIN')`, removendo via `avatarStore.remove` e limpando `avatarUrl` do alvo — verificar com teste novo que a foto some e a resposta traz `avatarUrl: null`.
- [x] 1.4 Registrar auditoria com `logger.info` contendo `actorUserId`, `targetUserId` e operação em ambas as rotas, sem conteúdo da imagem — verificar pelo teste que a operação ocorre e pela revisão do payload do log.

## 2. API — autorização, isolamento e erros

- [x] 2.1 Cobrir em `apps/api/src/avatar.test.ts` (ou arquivo equivalente) o RBAC: `TEAM_MEMBER` e `MANAGER` recebem 403 nas rotas administrativas, `ADMIN` altera foto de outro usuário e `ROOT` altera foto de `ADMIN` — verificar com `bun test apps/api/src/avatar.test.ts`.
- [x] 2.2 Cobrir isolamento anti-IDOR: alvo de outro tenant ou inexistente retorna 404 sem gravar/remover, e o alvo do próprio tenant nunca é afetado por requisições cross-tenant — verificar com teste dedicado.
- [x] 2.3 Cobrir validação: arquivo acima de `MAX_AVATAR_SIZE` retorna 413, formato não suportado retorna 415, multipart inválido retorna 400 e a foto anterior permanece intacta — verificar com teste dedicado.
- [x] 2.4 Confirmar que a rota de autoatendimento `PUT /users/me/avatar` continua acessível sem nível Admin e que `GET /users/:userId/avatar` segue servindo a foto recém-gravada com `ETag` da nova versão — verificar com teste de contrato.

## 3. Web — miniatura e diálogo de gestão de foto

- [x] 3.1 Adicionar coluna inicial na grade de `apps/web/src/pages/AdminUsersPage.tsx` com `UserAvatar size="sm"` por usuário (foto ou iniciais), dentro de `button` com `aria-label` "Foto de {nome}", ajustando `colSpan` das linhas de carregamento/vazio — verificar renderizando a página no teste de `admin-users-list.test.tsx`.
- [x] 3.2 Implementar o diálogo de gestão: seleção de arquivo validada por `isAcceptedAvatarFile`, recorte com `AvatarCropDialog`, upload por `api.upload` e remoção com confirmação, mantendo estados de processamento e erros visíveis — verificar com teste de UI que simula upload e remoção.
- [x] 3.3 Invalidar `queryKeys.adminUsers` após cada mutação e delegar ao `AuthContext` (`updateAvatar`/`removeAvatar`) quando o alvo for o próprio administrador, garantindo avatar do cabeçalho atualizado — verificar com teste que o alvo próprio não chama a rota administrativa.
- [x] 3.4 Garantir navegação por teclado e foco retornando ao botão da miniatura ao fechar o diálogo — verificar com teste `userEvent.tab`/`keyboard` no fluxo de abrir e cancelar.

## 4. Web — i18n e testes da página

- [x] 4.1 Adicionar as chaves novas em `adminUsers.*` nos três idiomas (`pt-BR`, `en`, `es` de `apps/web/src/i18n/locales/*/common.json`) sem duplicar chaves existentes — verificar com `bun run check:docs` e com o teste de i18n do projeto.
- [x] 4.2 Cobrir a coluna de miniatura e o diálogo em `apps/web/src/pages/admin-users-list.test.tsx` e, se necessário, novo arquivo `admin-users-avatar.test.tsx`, verificando miniatura por foto e por iniciais, upload e remoção — verificar com `bun test apps/web/src/pages`.
- [x] 4.3 Atualizar `apps/web/src/pages/admin-users-reset-password.test.tsx` caso a nova coluna altere seletores de tabela, mantendo o fluxo de redefinição de senha verde — verificar com o teste do arquivo.

## 5. Verificação de integração

- [x] 5.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir qualquer regressão — verificar saída verde.
- [x] 5.2 Rodar `bun run test:smoke` e exercitar manualmente `/admin/users` em pt-BR, en e es: incluir, substituir e remover foto de outro usuário e conferir reflexo na lista e no perfil do alvo — verificar ausência de erros no console e comportamento conforme os specs.
- [x] 5.3 Validar a change com `bun run openspec:validate` antes de pedir review — verificar saída sem erros.

## Workflow follow-up

- Arquivar a change após o merge e a aprovação, com `bunx openspec archive admin-user-photos --yes`.
