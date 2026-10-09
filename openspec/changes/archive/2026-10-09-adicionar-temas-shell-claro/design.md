# Design

## Context

Ver `proposal.md — Why`. Hoje os presets claros vivem em `:root[data-light-shell-theme="..."]` em `apps/web/src/styles/globals.css` e a lista canônica está **duplicada** em quatro pontos: `LightShellTheme` (`packages/ui-contracts`), `validShellThemes` (`apps/web/src/main.tsx`), `LIGHT_SHELL_THEMES` (`apps/web/src/contexts/AuthContext.tsx` e `apps/api/src/routes/users.ts`) e `preferencesSchema` (`apps/api/src/validation.ts`), além do enum SQLite e do CHECK PostgreSQL. A grade de seleção em `AccountPage.tsx` deriva de um array `SHELL_THEMES` com cores de amostra.

## Goals / Non-Goals

**Goals:**
- Adicionar 5 presets (`ruby`, `amber`, `amethyst`, `rose`, `silver`) com tokens `--shell-*` completos e amostras coerentes.
- Reduzir o risco de divergência entre frontend, API e banco tornando a lista de presets uma **fonte única** em `@azy-board/ui-contracts`.
- Manter `petroleum` como fallback/padrão e o mecanismo de aplicação via `data-light-shell-theme`, sem flash.

**Non-Goals:**
- Não criar temas escuros adicionais nem permitir temas personalizados pelo usuário.
- Não alterar o layout base da seção Aparência, a persistência ou o fluxo de tema automático por horário.
- Não alterar requisitos de outras capabilities.

## Decisions

### Fonte única da lista de presets

Definir em `packages/ui-contracts/src/index.ts` um array `LIGHT_SHELL_THEMES` (`as const`) e derivar `LightShellTheme` dele além de `DEFAULT_LIGHT_SHELL_THEME = 'petroleum'` e um guard `isLightShellTheme(value)`. Consumir em `main.tsx`, `AuthContext.tsx`, `users.ts` e `preferencesSchema` (`z.enum(LIGHT_SHELL_THEMES)`). O array `SHELL_THEMES` da `AccountPage` permanece com as cores de amostra, pois carrega dados visuais que os tokens não expõem ao TS.

- Alternativa considerada: manter os cinco `Set`/`enum` duplicados e apenas acrescentar strings. Rejeitada porque cada novo preset exigiria lembrar de seis lugares e o banco (CHECK PG) ficaria fora de sincronia silenciosamente.

### Paleta dos novos presets

Cada preset define os tokens na mesma estrutura dos atuais (shell escuro com acento vivo; exceções `classic` e `silver`, que são claros):

| Preset | sidebar | header | border | active | accent | accent-fg | muted |
|---|---|---|---|---|---|---|---|
| `ruby` | #5b1620 | #6b1b27 | #8f2f3d | #7a2230 | #ff6b81 | #3b0b13 | #e8bcc4 |
| `amber` | #5a3410 | #6b3e13 | #8f5a24 | #7a4a18 | #ffb15c | #3a2109 | #e7c9a3 |
| `amethyst` | #3f2a63 | #4a3174 | #6b4d9e | #553a86 | #b592ff | #241442 | #cec2e8 |
| `rose` | #5c1f3b | #6c2547 | #8f3a63 | #7c2c53 | #ff8fc0 | #3c0f24 | #e8bfd3 |
| `silver` | #cdd3dc | #e2e6ec | #aab2bd | #bcc3cd | #5b6675 | #ffffff | #56606d |

Os presets escuros usam `foreground` quase branco (#fff…); os claros (`classic` e `silver`) usam `foreground` escuro (`silver`: #29313c) para manter contraste. A amostra na `AccountPage` usa `sidebar`, `header` e `accent` exatamente como na tabela.

- Alternativa considerada: reutilizar acentos já existentes (ex.: roxo do `graphite`). Rejeitada porque cada preset deve ser visualmente distinguível na grade.

### Grade de seleção

Manter `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`; com 10 presets a grade passa a ocupar 2 linhas em telas largas, sem alteração estrutural nem de acessibilidade (o `radiogroup` e a navegação por setas já percorrem o array inteiro).

### Banco: CHECK PostgreSQL e enum SQLite

O perfil SIMPLE usa SQLite, cujo `text(..., { enum })` do Drizzle é apenas tipagem (sem CHECK) — basta atualizar o enum em `apps/api/src/db/schema.ts`. O perfil ADVANCED usa `check('users_shell_theme_check', ...)`: gerar nova migração PostgreSQL com `bun run --cwd apps/api db:generate` (config PG) ou `bunx drizzle-kit generate --config apps/api/drizzle.config.pg.ts`, atualizando `apps/api/src/db/postgres/schema.ts` para incluir os novos valores.

- Alternativa considerada: não alterar o CHECK e confiar só na validação da API. Rejeitada: o banco rejeitaria o UPDATE no perfil ADVANCED.

### Compatibilidade e migração de preferências

Nenhum valor existente é removido; usuários atuais permanecem válidos. Valores inválidos/antigos continuam caindo em `petroleum` pelo bootstrap e pela normalização em `AuthContext`.

## Risks / Trade-offs

- [Drift entre UI, API e banco ao adicionar presets] → fonte única em `ui-contracts` + migração PG + teste de paridade.
- [Contraste insuficiente em alguns acentos sobre sidebar] → escolher `accent` vivo com `accent-foreground` escuro e validar foco/ativo; teste visual claro.
- [Amostra da `AccountPage` divergir dos tokens reais] → revisão cruzada do array `SHELL_THEMES` com a tabela de tokens na implementação.
- [CHECK PG esquecido em produção ADVANCED] → tarefa explícita de migração + verificação no `check`.

## Migration Plan

1. Centralizar a lista em `ui-contracts` e ajustar consumidores (web/API).
2. Adicionar tokens no `globals.css`, amostras na `AccountPage` e rótulos i18n nos três idiomas.
3. Atualizar enum SQLite e CHECK PostgreSQL + gerar migração PG.
4. Rodar `bun run typecheck`, `bun run lint`, `bun run check:i18n` e testes; validar visualmente claro/escuro.

Rollback: remover os presets do array, dos tokens, dos rótulos e do schema/migração; nenhum dado de usuário precisa ser convertido (valores novos simplesmente deixam de ser aceitos).
