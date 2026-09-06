## Context

A listagem de projetos (`GET /api/projects`, em `apps/api/src/routes/projects.ts`) tem hoje dois ramos excludentes: se o usuário pertence ao grupo global `ADMIN`/`ROOT`, a consulta ignora `memberships` e devolve **todos** os projetos do tenant; caso contrário, faz `INNER JOIN` com `memberships` e devolve apenas os projetos com vínculo ativo. Não existe hoje qualquer noção de visibilidade além desse binômio "membro x admin".

As telas envolvidas são `ProjectsPage` (cards), `SettingsPage` (configuração do projeto), `ProfileDropdown`/`AccountPage` (preferências do usuário) e `AuthContext` (estado de sessão). O mesmo endpoint `GET /projects` é consumido pelo MCP (`toolListProjects`), portanto qualquer filtro aplicado aqui é herdado por agentes — o que é desejável, porque a spec `user-permissions` exige que agentes obedeçam exatamente ao escopo do Owner da API Key.

## Goals / Non-Goals

**Goals:**

- Permitir marcar um projeto como **Restrito**, de modo que ele só apareça na listagem para quem tem vínculo (gerente ou membro da equipe), inclusive derrubando o bypass de administrador.
- Permitir marcar um projeto como **Oculto**, de modo que ele saia das listagens até que o usuário ligue a preferência "mostrar projetos ocultos".
- Disponibilizar essa preferência no dropdown do avatar e na página `/account`, válida somente para a sessão e reiniciada a cada login.
- Manter defaults permissivos (`isRestricted = false`, `isHidden = false`) para não alterar o comportamento de projetos existentes.
- Filtrar no servidor, para que projetos ocultos ou restritos não sejam sequer transmitidos a quem não deve vê-los.

**Non-Goals:**

- Permitir acesso direto por URL a projeto restrito sem vínculo. Todo acesso a projeto restrito SHALL exigir membership ativa ou indicação como Gerente Geral, inclusive para Admin/Root, API Keys, MCP e agentes.
- Expor os novos campos nas tools MCP `create_project`/`update_project` (o catálogo de tools tem testes que fixam os campos atuais; isso fica para uma mudança futura).
- Persistir a preferência "mostrar projetos ocultos" em banco ou em `localStorage`.
- Criar UI de "solicitar acesso" a projeto restrito ou notificar administradores sobre projetos ocultos.

## Decisions

### Duas colunas booleanas em `projects`, defaults `false`

Adicionar `is_restricted` e `is_hidden` como `integer(..., { mode: 'boolean' }).notNull().default(false)` (padrão já usado em `assistantSettings.enabled`). Migração aditiva `ALTER TABLE projects ADD COLUMN ... NOT NULL DEFAULT 0`, sem backfill e sem janela de indisponibilidade.

*Alternativa considerada:* um único campo enum `visibility` (`PUBLIC | RESTRICTED | HIDDEN`). Rejeitada porque as duas flags são ortogonais — um projeto pode ser restrito **e** oculto — e um enum exigiria combinações explícitas para representar isso.

### Consulta única com `LEFT JOIN`, em vez de dois ramos

Substituir o `if (hasGlobalGroup(...,'ADMIN'))` por **uma** consulta que faz `LEFT JOIN memberships ON (project_id = projects.id AND user_id = :userId AND tenant_id = :tenantId)` e aplica:

```
WHERE projects.tenant_id = :tenantId
  AND ( :includeHidden = true OR projects.is_hidden = 0 )
  AND ( projects.is_restricted = 0
        OR memberships.id IS NOT NULL
        OR projects.manager_user_id = :userId )
```

O `role` devolvido continua sendo `memberships.role` quando existe vínculo e `'ADMIN'` para administradores globais sem vínculo, preservando o contrato atual.

*Alternativa considerada:* manter os dois ramos e adicionar o filtro de restrito em cada um. Rejeitada porque é exatamente a duplicação que produziu o bypass de admin e porque duplica a chance de divergência futura.

*Alternativa considerada:* filtrar apenas no frontend. Rejeitada porque transmitiria nomes e metadados de projetos ocultos/restritos para quem não deveria recebê-los.

### `includeHidden` como parâmetro de consulta

`GET /projects?includeHidden=true` é a única forma de receber projetos ocultos. O parâmetro é aceito apenas como `"true"`; qualquer outro valor (ou ausência) é tratado como `false`. O filtro de **restrito** é aplicado **sempre**, independentemente de `includeHidden` — ocultar não é permissão.

### Preferência de sessão em `sessionStorage`, exposta pelo `AuthContext`

A preferência "mostrar projetos ocultos" é guardada sob a chave `show-hidden-projects` em `sessionStorage`, lida na inicialização do `AuthContext` e zerada em `login()` e `logout()`. O `AuthContext` expõe `showHiddenProjects` e `setShowHiddenProjects(next)`, e `ProjectsPage` usa esse valor para montar a URL com `includeHidden=true` e refazer o fetch quando ele muda.

*Alternativa considerada:* estado apenas em memória no `AuthContext`. Rejeitada porque um F5 — que não é um novo login — derrubaria a preferência, contrariando "só irá durar até que ele faça o próximo login".

*Alternativa considerada:* nova coluna em `users` + `PATCH /users/me`. Rejeitada porque persistiria entre logins, o que é explicitamente indesejado, e exigiria alterar `ALLOWED_FIELDS` e o contrato de `/auth/me`.

O acesso ao storage segue o padrão de `BoardPage`: leitura com `try/catch` e fallback para `false`; gravação com `try {} catch {}` engolindo `SecurityError` (storage bloqueado por política do navegador).

### Toggles na criação e nas configurações, com a mesma guarda de hoje

- Modal "Novo projeto" (`ProjectsPage`): dois `Switch` logo abaixo do seletor de formato do board, ambos desligados por padrão.
- `SettingsPage`: nova seção "Visibilidade do projeto", no mesmo padrão visual da seção "Formato do board", salvando via `PATCH /projects/:id` com `{ isRestricted }` / `{ isHidden }`.

A criação segue exigindo `canCreateProject` (MANAGER/ADMIN/ROOT) e a edição segue exigindo `canAccessProjectSettings` — nenhuma guarda nova é introduzida.

### Sinalização visual dos cards fora do padrão

Os cards ocultos e restritos precisam ser identificáveis na listagem, mas o detalhamento visual (badge, ícone, tooltip, tratamento do card oculto) fica deliberadamente fora desta change: é o objeto de `add-project-card-visibility-badges`, que acrescenta requisitos à capacidade `project-visibility` aqui criada. Esta change apenas garante que `isRestricted` e `isHidden` cheguem ao frontend para que aquela possa sinalizá-los.

## Risks / Trade-offs

- **Administradores perdem acesso a projetos restritos sem vínculo** → comportamento pedido explicitamente; mitigado pela indicação do gerente/membership e pelo retorno 404 sem revelar a existência do projeto.
- **Clientes (incluindo agentes MCP) passam a receber menos projetos** → é o objetivo da mudança, mas é quebra de contrato; mitigado registrando o `includeHidden` e o filtro de restrito como requirements, e mantendo `list_projects` sem alteração de assinatura (só muda o resultado).
- **Preferência some ao fechar a aba** → `sessionStorage` é por aba/sessão; é o comportamento esperado para uma preferência sensível.
- **Projeto oculto usado como destino de navegação salva** → o projeto continua acessível por URL para usuários associados; apenas não aparece na lista.
- **Duplicação do estado da preferência entre aba e contexto** → o `AuthContext` é a única fonte de verdade em runtime; o `sessionStorage` é apenas o meio de sobreviver a recarregamentos.
- **Migração não coberta por snapshot** → o journal do Drizzle só tem snapshots até `0005`; a migração `0018` segue o padrão aditivo de `0006_simple-board-mode.sql`, e `migration.test.ts` valida idempotência aplicando tudo em `:memory:`.

## Migration Plan

1. Adicionar as colunas ao schema Drizzle e gerar/aplicar a migração `0018_*.sql` (`bun run db:generate` + `bun run db:migrate`).
2. Ajustar `GET /projects` (consulta única + `includeHidden`), `POST /projects` e `PATCH /projects/:id` no backend, com testes de integração.
3. Expor os tipos compartilhados em `packages/types`.
4. Implementar a preferência de sessão no `AuthContext` + `ProfileDropdown` + `AccountPage`.
5. Adicionar os toggles no modal de criação e na `SettingsPage`, com a sinalização visual nos cards.
6. Adicionar chaves de i18n em PT-BR, EN e ES.
7. Rodar `bun run check` (typecheck + lint + test + build) e, se o catálogo MCP for tocado, `bun run test:mcp-catalog` e `bun run test:agent-skill`.
8. **Rollback:** desligar as flags é suficiente para restaurar a listagem antiga (projetos com `is_restricted = 0` e `is_hidden = 0` se comportam exatamente como antes). Reverter o código sem reverter a migração é seguro, pois as colunas têm default e não são lidas por versões anteriores.

## Open Questions

Nenhuma questão bloqueante. O filtro de restrição é uma barreira de acesso server-side, não apenas um filtro da tela de listagem.
