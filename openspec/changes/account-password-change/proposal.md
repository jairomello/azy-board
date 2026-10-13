# Proposal

## Why

Hoje o usuário autenticado com usuário e senha do próprio Azy Board não tem como trocar a própria senha. A única forma de alterar uma credencial é um ADMIN criar/recriar o usuário, o que passa por terceiros e não é self-service. Isso obriga o usuário a depender do administrador e deixa a conta presa à senha definida na criação.

## What Changes

- Adicionar uma seção de segurança **Senha** na página `/account`, acima da seção de API Keys, com campos de senha atual, nova senha e confirmação, e ação de salvar.
- Adicionar endpoint autenticado `PATCH /users/me/password` para o usuário trocar a própria senha, validando a senha atual antes de gravar.
- Exigir política mínima para a nova senha: no mínimo 8 caracteres, com pelo menos uma letra maiúscula, um número e um símbolo.
- Rejeitar a troca quando a nova senha for igual à atual e quando a confirmação não coincidir.
- Expor o provedor de autenticação da instalação para a página `/account` e **ocultar** a seção de senha quando o provedor não for LOCAL (Microsoft/Google).
- Recusar a troca de senha no servidor (não apenas na UI) quando o provedor da instalação não for LOCAL.
- Manter as sessões já ativas válidas após a troca; a sessão atual permanece autenticada e não há revogação de outros cookies.
- Não alterar a semântica de login, RBAC, anti-IDOR ou do provedor integrado.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `auth`: adicionar o requisito de troca de senha pelo próprio usuário (usuário e senha local), com verificação da senha atual, política de senha e recusa quando o provedor da instalação é integrado.
- `account-settings`: adicionar o requisito da seção de senha na página `/account`, visível somente quando o provedor da instalação é LOCAL.

## Impact

- **API**: novo endpoint `PATCH /users/me/password` em `apps/api/src/routes/users.ts`; schema de validação em `apps/api/src/validation.ts`; uso dos helpers de hash/verificação em `apps/api/src/services/auth.ts`.
- **Persistência**: nova operação de atualização de `passwordHash` na porta de identidade (`apps/api/src/persistence/ports.ts`), implementada nos adapters SQLite e PostgreSQL.
- **Contratos**: `packages/api-contracts` ganha os tipos públicos da requisição/resposta de troca de senha; `AuthProvidersResponse` passa a ser consumido também pela página de conta.
- **Frontend**: nova seção em `apps/web/src/pages/AccountPage.tsx` (componente dedicado de senha), uso de `/auth/providers` para decidir visibilidade, strings i18n em PT-BR/EN/ES.
- **Segurança**: a senha atual é reverificada no servidor; a nova senha é armazenada como hash bcrypt, nunca em texto plano.
- **Fora de escopo**: revogação de sessões ativas, "esqueci minha senha"/reset por e-mail, troca de senha por administrador e [DB-SWAP] permanecem como estão (a nova operação segue o mesmo padrão de driver dos demais métodos de identidade).
