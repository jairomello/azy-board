## 1. Persistência e contrato

- [x] 1.1 Adicionar `isRestricted` e `isHidden` (booleanos, `notNull()`, default `false`) à tabela `projects` em `apps/api/src/db/schema.ts`, com comentário `// [TENANT]` registrando que a visibilidade é isolada por tenant
- [x] 1.2 Criar a migração aditiva `apps/api/src/db/migrations/0018_project-visibility.sql` (`ALTER TABLE projects ADD COLUMN is_restricted ... NOT NULL DEFAULT 0` e o mesmo para `is_hidden`), com comentários `[TENANT]` e `[DB-SWAP]` no topo, seguindo o padrão de `0006_simple-board-mode.sql`
- [x] 1.3 Registrar a migração em `apps/api/src/db/migrations/meta/_journal.json`
- [x] 1.4 Adicionar os tipos de visibilidade compartilhados em `packages/types/src/index.ts` (ex.: `ProjectVisibility` com `isRestricted` e `isHidden`)
- [x] 1.5 Rodar `bun run db:migrate` e conferir que `bun run --cwd apps/api test src/db/migration.test.ts` continua verde

## 2. Backend — listagem, criação e alteração

- [x] 2.1 Extrair uma função nomeada de montagem do filtro de visibilidade (ex.: `aplicarFiltroVisibilidadeProjetos`) usada por `GET /projects`, mantendo `tenant_id` sempre no `WHERE` com comentário `// [TENANT]`
- [x] 2.2 Substituir os dois ramos de `GET /projects` (admin x membro) por uma consulta única com `LEFT JOIN memberships` filtrando por `user_id` e `tenant_id`
- [x] 2.3 Aplicar a condição de restrito: `is_restricted = 0 OR memberships.id IS NOT NULL OR projects.manager_user_id = :userId`
- [x] 2.4 Aplicar a condição de oculto: `:includeHidden = true OR projects.is_hidden = 0`, lendo `includeHidden` de `c.req.query('includeHidden')` e aceitando apenas o literal `"true"`
- [x] 2.5 Preservar o `role` retornado (`memberships.role` quando há vínculo; `'ADMIN'` para grupo global ADMIN/ROOT sem vínculo)
- [x] 2.6 Manter o filtro de escopo da API Key (`apiKeyProjectScope`) aplicado depois da consulta
- [x] 2.7 Aceitar e persistir `isRestricted` / `isHidden` em `POST /projects`, validando como booleanos e devolvendo ambos na resposta 201
- [x] 2.8 Aceitar e persistir `isRestricted` / `isHidden` em `PATCH /projects/:id` pelo padrão `updates` com `if (x !== undefined)`
- [x] 2.9 Garantir que o criador de um projeto restrito continue vendo o projeto (membership ADMIN é criada na transação)

## 3. Backend — testes

- [x] 3.1 Teste: membro vê projeto restrito do qual participa
- [x] 3.2 Teste: gerente geral vê projeto restrito que gerencia
- [x] 3.3 Teste: usuário sem vínculo não recebe projeto restrito
- [x] 3.4 Teste: Admin e Root **não** recebem projeto restrito sem vínculo
- [x] 3.5 Teste: projeto oculto não é retornado sem `includeHidden` e é retornado com `includeHidden=true`
- [x] 3.6 Teste: projeto oculto **e** restrito sem vínculo não é retornado nem com `includeHidden=true`
- [x] 3.7 Teste: valores inválidos de `includeHidden` são tratados como `false`
- [x] 3.8 Teste: isolamento entre tenants para projetos restritos e ocultos
- [x] 3.9 Teste: agente com API Key herda a filtragem e continua limitado pelo escopo da chave
- [x] 3.10 Teste: `POST` e `PATCH` persistem os sinalizadores e rejeitam não booleanos com 400

## 4. Frontend — preferência de sessão

- [x] 4.1 Criar helper de leitura/gravação da chave `show-hidden-projects` em `sessionStorage`, com `try/catch` e fallback `false`
- [x] 4.2 Expor `showHiddenProjects` e `setShowHiddenProjects` no `AuthContext`, inicializando a partir do helper
- [x] 4.3 Zerar a preferência em `login()` e `logout()` do `AuthContext`
- [x] 4.4 Adicionar o item "Mostrar projetos ocultos" no `ProfileDropdown` com `role="switch"` e `aria-checked`
- [x] 4.5 Adicionar a seção de visibilidade de projetos na `AccountPage`, antes da seção de API Keys, usando o mesmo controle do dropdown

## 5. Frontend — interface de projetos

- [x] 5.1 Atualizar o tipo `Project` em `ProjectsPage` com `isRestricted` e `isHidden`
- [x] 5.2 Enviar `includeHidden=true` no fetch de `/projects` quando a preferência estiver ligada e refazer a requisição ao alterná-la
- [x] 5.3 Adicionar os toggles "Restrito" e "Oculto" no modal de criação, desligados por padrão, com texto explicativo
- [x] 5.4 Enviar `isRestricted` / `isHidden` no `POST /projects`
- [x] 5.5 Adicionar a seção "Visibilidade do projeto" na `SettingsPage`, salvando via `PATCH /projects/:id`
- [x] 5.6 Adicionar as chaves de i18n em `pt-BR`, `en` e `es` (namespaces `settings` e `common`)

> Nota: a sinalização visual dos cards ocultos e restritos **não** faz parte desta change. Ela é especificada e implementada por `add-project-card-visibility-badges`, que depende desta.

## 6. Qualidade e documentação

- [x] 6.1 Criar contrato de UI em `apps/web/src/project-visibility-contract.test.ts` cobrindo toggles do modal, seção da `SettingsPage`, item do dropdown e o `includeHidden` no fetch
- [x] 6.2 Rodar `bun run typecheck` e `bun test` sem erros
- [x] 6.3 Conferir que `list_projects` do MCP continua funcionando e que o catálogo não foi alterado (`bun run test:mcp-catalog`)
- [x] 6.4 Revisar o `SECURITY_CHECKLIST.md` quanto ao novo filtro de listagem
- [x] 6.5 Documentar o comportamento dos toggles e da preferência de sessão na wiki em `docs/azyboard-wiki/`, em PT-BR
