# Design

## Context

Ver `proposal.md` para a motivação. O estado atual que molda a abordagem:

- O provedor de autenticação humana é escolhido na instalação via `AZYBOARD_AUTH_PROVIDER` (`LOCAL` | `MICROSOFT` | `GOOGLE`) e resolvido por `resolveAuthConfig` em `apps/api/src/services/authConfig.ts`.
- `GET /auth/providers` já expõe publicamente o provedor e o início do fluxo OAuth, sem segredos; hoje só a `LoginPage` consome essa resposta.
- O hash e a verificação de senha já existem em `apps/api/src/services/auth.ts` (`hashPassword`/`verifyPassword`, bcrypt custo 12), usados pelo login e pela criação de usuário por ADMIN.
- `PATCH /users/me` já segue o padrão "alvo derivado exclusivamente da sessão" com `userPersistenceContext(ctx)` e atualizações escopadas por `(tenant_id, userId)`.
- A porta `IdentityPort` concentra as operações de identidade e é implementada nos adapters SQLite e PostgreSQL.

## Goals / Non-Goals

**Goals:**

- Troca de senha self-service verificada no servidor, com política mínima aplicada no backend.
- Seção de senha em `/account` visível apenas em instalações com provedor local.
- Reutilizar os helpers, portas, contextos e padrões de validação já existentes, sem introduzir dependências novas.

**Non-Goals:**

- Revogar ou invalidar sessões já emitidas após a troca (decisão do usuário: manter sessões ativas; exigiria versionamento de token).
- Fluxo de "esqueci minha senha"/reset por e-mail e troca de senha por administrador.
- Alterar o comportamento de login, RBAC, anti-IDOR ou do provedor integrado.

## Decisions

### Endpoint dedicado `PATCH /users/me/password`

Um endpoint próprio em vez de estender `PATCH /users/me` (`preferencesSchema`), porque a senha tem pré-condições (senha atual, política, confirmação) e semântica de segurança distintas das preferências de aparência. Mantém `ALLOWED_FIELDS` de `/users/me` livre de campos sensíveis e evita expor senha no fluxo de preferências. Alternativas consideradas: (a) incluir `password` em `PATCH /users/me` — rejeitada por misturar responsabilidades e dificultar a recusa por provedor; (b) rota sob `/auth` — rejeitada por ser operação de perfil do usuário autenticado, alinhada à família `/users/me`.

### Verificação da senha atual + política no servidor

A senha atual é validada com `verifyPassword` antes de qualquer gravação; a recusa por senha atual incorreta responde 401 com mensagem genérica, coerente com o login. A política (≥8 caracteres, maiúscula, número, símbolo) e a confirmação são validadas por schema em `apps/api/src/validation.ts`, com a checagem "nova ≠ atual" feita após a verificação da senha atual. A UI repete a validação apenas como feedback imediato; o servidor é a fonte de verdade. Alternativa considerada: confiar apenas na validação da UI — rejeitada por segurança (cliente não é confiável).

### Ocultar por provedor no cliente, recusar no servidor

A página `/account` reutiliza a resposta de `GET /auth/providers` (via um pequeno hook ou carregamento pontual) para decidir a visibilidade da seção; o servidor recusa a troca quando o provedor não é LOCAL usando `resolveAuthConfig()`, espelhando o padrão já adotado em `POST /auth/login` (`PASSWORD_LOGIN_DISABLED`). Isso mantém a UI consistente e a regra imposta no backend.

### Persistência por operação na `IdentityPort`

Nova operação `updateUserPassword(context, userId, passwordHash)` na `IdentityPort`, escopada por `(tenant_id, userId)` e implementada nos adapters SQLite e PostgreSQL no mesmo formato de `updateUserName`. Manter na porta preserva a abstração de driver e o `[DB-SWAP]`. Alternativa considerada: UPDATE direto na rota — rejeitada por quebrar o isolamento por porta/contexto.

### Manter sessões ativas

A troca de senha não altera o JWT nem invalida cookies existentes. Decisão explícita do usuário; no futuro, revogação exigiria um campo de versão de credencial no usuário e checagem no middleware — fora deste escopo.

## Risks / Trade-offs

- [Fixação de sessão pós-troca de senha] → Aceito por decisão do usuário; documentado como não-goal e candidato a mudança futura com versionamento de token.
- [Divergência entre validação da UI e do servidor] → Mitigado centralizando a regra de política no schema do servidor e testando os cenários de rejeição; a UI usa mensagens do servidor quando presentes.
- [Custo de bcrypt custo 12 na troca] → Mesmo custo já usado no login e na criação de usuário; aceitável para operação esporádica.
- [Indisponibilidade de `/auth/providers` na conta] → Se a resposta falhar, a seção assume o modo mais restritivo (oculta) e o servidor continua sendo a barreira final.
