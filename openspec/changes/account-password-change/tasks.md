# Tasks

## 1. Contratos e validação

- [ ] 1.1 Definir em `packages/api-contracts` os tipos públicos da troca de senha (corpo da requisição com senha atual, nova senha e confirmação; resposta de sucesso), exportando-os no índice; verificar com `bun run --cwd packages/api-contracts build` (ou typecheck do pacote) que os tipos compilam e estão exportados
- [ ] 1.2 Adicionar o schema da nova senha em `apps/api/src/validation.ts` com a política (≥8 caracteres, maiúscula, número e símbolo) e registrar como `ChangePasswordRequest` na tabela de schemas de contrato; verificar com um teste unitário que senhas fora da política e confirmação divergente são rejeitadas

## 2. Persistência

- [ ] 2.1 Adicionar `updateUserPassword(context, userId, passwordHash)` à `IdentityPort` em `apps/api/src/persistence/ports.ts`, com comentário `// [TENANT]` indicando o escopo `(tenant_id, userId)`
- [ ] 2.2 Implementar `updateUserPassword` no adapter SQLite (`apps/api/src/db/sqlite/adapter.ts`) usando `withTenant`/`userPersistenceContext` e retornando o usuário atualizado ou `null`; verificar com teste de adapter que o hash é gravado e que outro tenant não é afetado
- [ ] 2.3 Implementar `updateUserPassword` no adapter PostgreSQL (`apps/api/src/db/postgres/adapter.ts`) com o mesmo contrato e comentário `// [DB-SWAP]` se houver ponto de troca de driver; verificar com o mesmo teste de adapter executado no perfil PostgreSQL
- [ ] 2.4 Garantir que o novo método não expõe `passwordHash` em tipos públicos; verificar com typecheck strict e com teste que a resposta pública continua sem o campo

## 3. Endpoint de troca de senha

- [ ] 3.1 Criar `PATCH /users/me/password` em `apps/api/src/routes/users.ts`: carregar o usuário pela sessão, recusar com 403 quando `resolveAuthConfig().provider !== 'LOCAL'`, validar o corpo pelo schema da tarefa 1.2 e verificar a senha atual com `verifyPassword`; verificar com testes de rota cobrindo sucesso, senha atual incorreta (401 genérico) e provedor integrado (403)
- [ ] 3.2 Aplicar a política e a checagem "nova senha diferente da atual", gravar o hash via `hashPassword` na nova operação da porta e responder sucesso; verificar com testes de rota para política inválida (400), confirmação divergente (400) e nova igual à atual (400)
- [ ] 3.3 Emitir comentários `// [TENANT]` onde `tenant_id`/`userId` entram na query e confirmar a ausência de ID de usuário vindo do cliente; verificar com teste de anti-IDOR que enviar outro `userId` não altera a senha de terceiros

## 4. Seção de senha na página de conta

- [ ] 4.1 Criar o componente de seção de senha (campos senha atual, nova senha, confirmação, ação salvar, estado de envio e exibição de erros) e integrá-lo em `apps/web/src/pages/AccountPage.tsx`; verificar com teste de componente que o envio válido chama a API e limpa os campos
- [ ] 4.2 Expor o provedor de autenticação à página de conta reutilizando `GET /auth/providers` e ocultar a seção quando o provedor não for LOCAL, exibindo a indicação de senha gerenciada pelo provedor; verificar com teste de componente para os dois provedores (LOCAL mostra campos; MICROSOFT/GOOGLE não mostra e exibe a indicação)
- [ ] 4.3 Adicionar as strings i18n da seção em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json` e verificar que não há chaves faltando nos três idiomas (checagem de paridade de chaves)
- [ ] 4.4 Tratar falhas do servidor no formulário exibindo a mensagem retornada e mantendo os campos editáveis; verificar com teste de componente simulando 401 (senha atual incorreta) e 400 (política)
- [ ] 4.5 Documentar a funcionalidade de troca de senha na documentação da aplicação (ex.: `docs/`), indicando que só se aplica ao provedor local; verificar lendo o trecho documentado e confirmando que bate com o comportamento implementado

## 5. Verificação de integração

- [ ] 5.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir o que falhar
- [ ] 5.2 Rodar `bun run test:smoke` para o fluxo web/API e confirmar que login local, página de conta e troca de senha funcionam de ponta a ponta
