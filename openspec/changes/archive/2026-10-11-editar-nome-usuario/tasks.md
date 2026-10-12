# Tasks

## 1. Validação e persistência do nome

- [x] 1.1 Estender o schema do `PATCH /users/me` em `apps/api/src/validation.ts` para aceitar `name` opcional com `trim().min(1).max(200)` (mesma regra de `createUserSchema`), mantendo `email` fora do schema; verificar com teste de validação que nome válido passa e vazio/`>200`/campo desconhecido falham
- [x] 1.2 Adicionar `name` à allowlist `ALLOWED_FIELDS` em `apps/api/src/routes/users.ts` sem incluir `email`; verificar com teste que o corpo com `name` é aceito e que campo desconhecido continua rejeitado com 400
- [x] 1.3 Adicionar a operação `updateUserName` (ou patch de perfil) em `apps/api/src/persistence/ports.ts` como método separado de `updateUserPreferences`, documentando que o alvo é sempre `(tenant_id, userId)` (`// [TENANT]`)
- [x] 1.4 Implementar `updateUserName` no adaptador SQLite (`apps/api/src/db/sqlite/adapter.ts`) com atualização escopada por tenant e usuário; verificar com teste unitário que o nome é persistido e que outro usuário não é afetado
- [x] 1.5 Implementar `updateUserName` no adaptador PostgreSQL (`apps/api/src/db/postgres/adapter.ts`) com o mesmo filtro de tenant; verificar que compila em modo strict e que o SQL usa colunas `snake_case`
- [x] 1.6 Adicionar caso de paridade em `apps/api/src/db/postgres/parity.test.ts` provando que SQLite e PostgreSQL persistem e releem o mesmo nome

## 2. Rota de atualização do próprio perfil

- [x] 2.1 Ajustar o handler `PATCH /api/users/me` (`apps/api/src/routes/users.ts`) para aplicar `name` via `updateUserName` quando presente, mantendo as preferências atuais e respondendo `{ user }` com o nome atualizado; verificar com teste de integração que o retorno traz o novo nome
- [x] 2.2 Garantir anti-IDOR: a rota nunca aceita ID de usuário no corpo/URL e aplica sempre `ctx.userId` + tenant; verificar com teste que o nome de outro usuário do mesmo tenant permanece inalterado
- [x] 2.3 Garantir que `email` não é alterável pelo fluxo; verificar com teste que enviar `email` no corpo é rejeitado (schema strict) e que `GET /auth/me` mantém o e-mail original
- [x] 2.4 Verificar que a sessão permanece válida após a edição (nome não está no JWT) com teste que reutiliza o cookie para `GET /auth/me` e confirma o novo nome

## 3. Frontend da página de conta

- [x] 3.1 Estender `apps/web/src/contexts/AuthContext.tsx` com a ação `updateName` que chama `PATCH /users/me` e aplica o `user` retornado ao estado; verificar com teste que o estado do usuário é atualizado com o valor do servidor
- [x] 3.2 Adicionar o campo editável de nome na seção de perfil (`apps/web/src/components/ProfilePhotoSection.tsx` ou `apps/web/src/pages/AccountPage.tsx`) com botão de salvar, estados de carregando/sucesso/erro e e-mail somente leitura; verificar com teste de componente que editar e salvar chama a API e reflete o novo nome
- [x] 3.3 Tratar nome inválido (vazio/apenas espaços/`>200`) no cliente antes do envio e exibir mensagem; verificar com teste de componente que o envio inválido não chama a API
- [x] 3.4 Invalidar o cache de listagens que exibem nomes de usuário após salvar; verificar com teste/inspeção que a lista não mantém o nome antigo

## 4. i18n

- [x] 4.1 Adicionar as chaves do campo de nome (rótulo, salvar, salvo, erros) em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`, sem reutilizar a chave genérica `name`; verificar com `bun run check:i18n`

## 5. Verificação de integração

- [x] 5.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [ ] 5.2 Rodar `bun run test:smoke` validando o fluxo web/API com a edição de nome
- [x] 5.3 Rodar `openspec validate editar-nome-usuario --strict` e ajustar o que for apontado

## Workflow follow-up

- Registrar `Board ref: 99fe4f39-9a74-47b9-bbf7-ed3e2ffe5193` nos artefatos e, ao concluir a implementação, fechar o card T54 com `complete_task`, confirmando no board que o status é `DONE`.
- Arquivar a change após a implementação e a revisão do projeto.
