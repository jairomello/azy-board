# Tasks

## 1. Fonte única e contratos

- [x] 1.1 Em `packages/ui-contracts/src/index.ts`, adicionar `LIGHT_SHELL_THEMES` (`as const`) com os 10 presets, derivar `LightShellTheme` dele, expor `DEFAULT_LIGHT_SHELL_THEME = 'petroleum'` e o guard `isLightShellTheme`. Verificar com `bun run typecheck`.
- [x] 1.2 Consumir a lista canônica em `apps/web/src/main.tsx` e `apps/web/src/contexts/AuthContext.tsx` (substituindo os `Set` locais) e em `apps/api/src/routes/users.ts` e `apps/api/src/validation.ts` (`preferencesSchema` via `z.enum(LIGHT_SHELL_THEMES)`). Verificar com `bun run typecheck`.

## 2. Apresentação no frontend

- [x] 2.1 Adicionar em `apps/web/src/styles/globals.css` os blocos `:root[data-light-shell-theme="ruby|amber|amethyst|rose|silver"]` com todos os tokens `--shell-*` (sidebar, header, border, foreground, muted, active, accent, accent-foreground) conforme a tabela do `design.md`. Verificar trocando `data-light-shell-theme` no `<html>` e conferindo sidebar/header sem reload.
- [x] 2.2 Acrescentar os 5 presets ao array `SHELL_THEMES` de `apps/web/src/pages/AccountPage.tsx` com as cores de amostra (`sidebar`, `header`, `accent`) idênticas aos tokens. Verificar que a grade exibe 10 presets (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`) e que a seleção persiste.
- [x] 2.3 Adicionar as chaves de `shellThemes` dos 5 novos presets em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`. Verificar com `bun run check:i18n`.

## 3. Persistência e banco

- [x] 3.1 Atualizar o enum de `lightShellTheme` em `apps/api/src/db/schema.ts` (SQLite) e o `check('users_shell_theme_check', ...)` em `apps/api/src/db/postgres/schema.ts` com os novos valores. Verificar com `bun run typecheck` e, no perfil ADVANCED, aplicando a migração.
- [x] 3.2 Gerar a migração PostgreSQL (`bunx drizzle-kit generate --config apps/api/drizzle.config.pg.ts`) e conferir o novo arquivo + `apps/api/src/db/postgres/migrations/meta/_journal.json`. Verificar aplicando `bun run --cwd apps/api db:migrate:pg` em banco de teste.

## 4. Testes e verificação final

- [x] 4.1 Adicionar teste de paridade garantindo que a lista canônica `LIGHT_SHELL_THEMES` casa com os rótulos i18n dos 3 locales e com as amostras de `SHELL_THEMES`, e teste da API de que `PATCH /api/users/me` aceita os novos presets e rejeita valor desconhecido. Verificar com `bun test --isolate` (ou `bun run test:web` e `bun run --cwd apps/api test:integration`).
- [x] 4.2 Rodar `bun run check` e validar visualmente a seção Aparência nos temas claro e escuro, com 10 presets selecionáveis e contraste AA. Evidência: build/testes verdes e conferência visual.

## Workflow follow-up

- Executar `bun run check` e `bun run test:smoke` ao concluir, conforme o repositório.
- Se o trabalho for vinculado a um card do Azy Board, registrar `Board ref: <itemId>` e fechar o card com `complete_task`.
