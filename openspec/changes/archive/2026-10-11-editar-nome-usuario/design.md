## Context

Ver `proposal.md` — Why. O estado atual relevante:

- `PATCH /api/users/me` (`apps/api/src/routes/users.ts:79`) é o único caminho de atualização do próprio perfil. Ele valida com `preferencesSchema` (`.strict()` em `apps/api/src/validation.ts:185`), aplica uma allowlist `ALLOWED_FIELDS` (`users.ts:16`) e chama `persistence.identity.updateUserPreferences` escopado a `ctx.userId`. `name` é hoje rejeitado em dois pontos.
- `users.name` é `NOT NULL`, sem unicidade, presente nos schemas SQLite (`apps/api/src/db/schema.ts:53`) e PostgreSQL (`apps/api/src/db/postgres/schema.ts:50`). Não há migration necessária.
- `name` **não** faz parte do `JwtPayload` (`packages/api-contracts/src/index.ts:16-26`), portanto alterá-lo não invalida a sessão.
- `GET /auth/me` e o login retornam o registro persistido (menos `passwordHash`), então refletem o novo nome após a atualização; `assignee`/`author` de itens são joins ao vivo.
- `UserAvatar` deriva iniciais de `name`; o `AuthContext` mantém o usuário em memória e já reconcilia via `api.patch<{ user }>` em `updatePreferences`.
- `createUserSchema` já define a regra de tamanho do nome (`name: z.string().trim().min(1).max(200)`).

## Goals / Non-Goals

**Goals:**
- Permitir editar o próprio nome de exibição com validação consistente entre UI e API.
- Manter o e-mail (login) estritamente imutável e somente leitura nesse fluxo.
- Preservar isolamento por tenant e anti-IDOR (nunca atualizar outro usuário).
- Manter paridade SQLite/PostgreSQL e refletir a mudança na sessão sem novo login.
- Preservar os contratos existentes (`/auth/me`, login, joins de usuário).

**Non-Goals:**
- Qualquer alteração de e-mail/login, senha ou identidade externa.
- Edição administrativa do nome de terceiros, histórico/apelidos, unicidade de nome.
- Novas migrations ou mudanças de schema de banco.

## Decisions

### D1. Estender `PATCH /users/me` em vez de criar rota nova
O endpoint existente já é genérico (`/users/me`) e escopado ao usuário autenticado. Estendê-lo evita duplicar autorização/validação. Alternativa rejeitada: `PATCH /users/me/profile` dedicado, que fragmentaria o mesmo recurso sem ganho observável.

### D2. Porta de persistência dedicada ao nome
Adicionar `updateUserName(context, name, updatedAt)` (ou `updateUserProfile`) em vez de sobrecarregar `updateUserPreferences`. Motivo: o nome não é preferência; separar mantém a semântica clara e permite um teste de paridade direto SQLite×PostgreSQL. A rota pode aplicar `name` e preferências na mesma requisição, escolhendo a operação correta por campo.

### D3. Validação única e compartilhada
Reutilizar a regra de `createUserSchema` para o nome no schema de `PATCH /users/me` (trim, `min(1)`, `max(200)`) e incluir `name` na allowlist `ALLOWED_FIELDS`. Os dois pontos precisam mudar juntos: manter a dupla trava evita campos não suportados e é o padrão do projeto. `email` continua fora do schema e da allowlist.

### D4. Estado do cliente confirmado pelo servidor
O `AuthContext` ganha uma ação `updateName` que faz `PATCH /users/me` e aplica o `user` devolvido pela resposta ao estado (substituindo o modelo otimista simples), garantindo que a UI reflita o nome normalizado pelo servidor. Após sucesso, invalidar caches de listagens que exibem nomes (ex.: lista de admin) para não exibir dados obsoletos.

### D5. Sem migration
`users.name` já existe nos dois adaptadores. A entrega é apenas código (porta, adaptadores, rota, validação, contexto e UI).

### D6. Chaves i18n dedicadas
Adicionar chaves específicas do campo (rótulo, salvar, salvo, erro) em vez de reutilizar a chave genérica `name` do namespace `settings`, evitando ambiguidade de reuso. Chaves presentes nos três idiomas para satisfazer `check:i18n`.

## Risks / Trade-offs

- **Dupla trava schema/allowlist** → alterar `preferencesSchema` e `ALLOWED_FIELDS` na mesma mudança e cobrir com teste (nome aceito; campo desconhecido ainda rejeitado).
- **Exposição de e-mail** → manter `email` ausente do schema/allowlist e adicionar teste que garanta que o e-mail não é alterado.
- **Cache de listagens com nome antigo** → invalidar o cache de usuários após salvar; o join ao vivo nos cards já reflete.
- **i18n** → qualquer chave fora dos três locales quebra `check:i18n`; adicionar em `pt-BR`, `en`, `es`.
- **Regressão de contrato de sessão** → `name` já não está no JWT; teste garante que a sessão permanece válida após a edição.
