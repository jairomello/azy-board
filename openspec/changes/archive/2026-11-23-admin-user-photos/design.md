# Design

## Context

A foto de perfil já existe ponta a ponta: rotas `PUT`/`DELETE /api/users/me/avatar` e `GET /api/users/:userId/avatar` em `apps/api/src/routes/users.ts`, normalização em `services/avatarImage.ts`, armazenamento isolado por tenant em `services/avatarStore.ts`, ponteiro `users.avatar_url` via `persistence.identity.updateAvatarUrl(context, userId, url)` e cache invalidado pelo hash na URL (`?v=<hash>`). No front-end, `/account` já usa `AvatarCropDialog` + `lib/avatarImage` + `AuthContext.updateAvatar/removeAvatar`.

A lista `/admin/users` (`AdminUsersPage.tsx`) já recebe `avatarUrl` por usuário, usa React Query com chave `queryKeys.adminUsers(user.id)` e invalida após cada mutação. Ver `proposal.md` para a motivação.

## Goals / Non-Goals

**Goals:**
- Reaproveitar integralmente a validação, normalização, armazenamento e serving de foto já existentes, sem novo modelo de dados.
- Expor a gestão de foto como operação administrativa autorizada no servidor, com escopo de tenant.
- Manter o padrão de UI e de cache da página de administração já existente.

**Non-Goals:**
- Não criar galeria/histórico de fotos, aprovação do usuário alvo ou notificação ao usuário.
- Não alterar o fluxo de autoatendimento em `/account`, nem o serving/cache da foto.
- Não mexer em `avatarStore`, no esquema do banco, em export/backup ou em contratos MCP.

## Decisions

**1. Rotas administrativas dedicadas em vez de sobrecarregar `/users/me/avatar`.**
`PUT /api/users/:userId/avatar` e `DELETE /api/users/:userId/avatar`, registradas após as rotas `/me/avatar` e protegidas por `requireGlobalGroup('ADMIN')` (o helper aceita `ROOT` por ser nível superior). Alternativa considerada: aceitar `userId` no corpo de `/users/me/avatar` — rejeitada porque mistura autorização de alvo com rota de autoatendimento e amplia superfície de erro de IDOR. O registro depois de `/me/avatar` garante precedência da rota literal.

**2. Um único serviço interno de gravação de foto com alvo explícito.**
Extrair das rotas atuais uma função que recebe `targetUserId` e faz: `findUser` no tenant (404 se não existir) → `normalizeAvatar` → `avatarStore.save` → `updateAvatarUrl`. As rotas de autoatendimento passam a chamá-la com `ctx.userId` (comportamento idêntico) e as administrativas com o `userId` do path. Alternativa: duplicar o bloco de gravação — rejeitada por risco de divergência de validação e de logs. Todo ponto de query mantém comentário `// [TENANT]` com o alvo explícito.

**3. Resposta administrativa com o usuário público atualizado e invalidação do cache da lista.**
As rotas administrativas devolvem `{ user: { id, name, email, avatarUrl, globalGroup } }`, no mesmo formato das linhas da listagem. A página mantém o padrão já usado em grupo e reset de senha: `invalidateQueries(queryKeys.adminUsers(...))` e refetch — sem mutação otimista. Alternativa: atualizar o cache manualmente — rejeitada por fugir do contrato de cache da tela (`migrated-screens-cache-contract.test.ts`).

**4. Erros reaproveitam o contrato atual de avatar.**
`MAX_AVATAR_SIZE`/`AvatarValidationError` continuam devolvendo 413 com `PAYLOAD_TOO_LARGE`, 415 para formato inválido, 400 para multipart inválido e 404 para alvo inexistente ou de outro tenant — mesmo shape `{ error, code, retryable }` das demais rotas.

**5. Administrador editando a própria foto usa o fluxo de autoatendimento.**
Se a linha acionada for a do usuário autenticado, a página chama `updateAvatar`/`removeAvatar` do `AuthContext`, que também atualiza o avatar do cabeçalho. As rotas administrativas ficam restritas a alvos diferentes do executor. Alternativa: sempre usar a rota administrativa e forçar recarga da sessão — rejeitada por deixar o cabeçalho desatualizado até o próximo carregamento.

**6. UI: coluna de miniatura como primeira célula, com diálogo reutilizado.**
A grade ganha uma coluna inicial estreita com `UserAvatar` (tamanho `sm`) envolvido por um `button` com `aria-label` do tipo "Foto de {nome}", abrindo um diálogo de gestão. O diálogo reutiliza `AvatarCropDialog` (labels já traduzidos no namespace `settings`, carregado globalmente pelo i18n) e, quando o usuário tem foto, oferece "Remover foto" com confirmação. As chaves novas ficam em `common` sob `adminUsers.*` nos três idiomas. Alternativa: `input type=file` embutido na linha — rejeitada por perder o recorte quadrado e a consistência com `/account`.

**7. Auditoria por log estruturado, sem conteúdo de imagem.**
Cada alteração/remoção administrativa registra `logger.info` com `actorUserId`, `targetUserId` e operação, no mesmo padrão do reset de senha por ROOT. Alternativa: gravar em tabela de auditoria — rejeitada por não haver tabela de auditoria de ações administrativas no projeto e por estar fora do escopo.

**8. Orçamento de bundle do `index` elevado com justificativa.**
As 15 mensagens novas em pt/en/es entram no chunk `index` (os locales são carregados no entry, conforme o card T88) e levaram o gzip a 99,92 KB, acima do teto anterior de 102000 bytes. O limite subiu para 104000 em `apps/web/bundle-budget.json`, seguindo o precedente registrado no próprio arquivo, que já foi elevado por novas mensagens de produto.

## Risks / Trade-offs

- **[Admin altera foto de Root]** → decisão aprovada pelo usuário; mitigada por RBAC `ADMIN` no servidor e log de auditoria com executor e alvo.
- **[Interceptação da rota `/me/avatar` por `/:userId/avatar`]** → ordem de registro fixa (`/me/avatar` antes) e teste de contrato da rota de autoatendimento.
- **[Cache do navegador exibindo foto antiga]** → URL versionada muda a cada gravação; testes cobrem troca de URL e `ETag`.
- **[Lista pesada com imagens]** → `UserAvatar` usa a miniatura já normalizada (256×256) e o mesmo cache privado de 24h; nenhuma nova requisição por linha além da imagem já servida hoje no restante do app.
- **[Usuário alvo sem ciência da troca]** → aceito pelo escopo; a foto aparece nas próximas renderizações e o usuário pode substituí-la em `/account`.

## Migration Plan

Sem migração de banco. Deploy normal do pacote `api` + `web`; rollback é reverter os commits — fotos gravadas permanecem válidas porque o modelo e o `AvatarStore` não mudam.

## Open Questions

Nenhuma pendente.
