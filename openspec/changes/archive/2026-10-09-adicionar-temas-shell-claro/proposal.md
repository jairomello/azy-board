# Proposal

## Why

A seção **Aparência** de `/account` oferece apenas cinco presets de shell claro (Petróleo, Oceano, Esmeralda, Grafite, Clássico), concentrados em tons frios/neutros. Usuários pediram mais personalização com identidades quentes e vibrantes (vermelho, laranja, roxo e afins). Ampliar o catálogo melhora a expressão visual do workspace sem alterar o comportamento claro/escuro.

## What Changes

- Adicionar **5 novos presets** de shell claro, mantendo os 5 atuais:
  - `ruby` — Vermelho
  - `amber` — Laranja (Âmbar)
  - `amethyst` — Roxo (Ametista)
  - `rose` — Rosa
  - `silver` — Prata (cinza/prateado, claro)
- Cada preset define os tokens `--shell-*` (sidebar, header, borda, texto, ativo, acento, muted) para o modo claro, aplicados via `data-light-shell-theme` no `<html>`.
- Exibir os novos presets na grade de seleção de `Aparência` (com swatch coerente e navegação por teclado já existente), sem alterar o layout base.
- Estender `LightShellTheme`, os conjuntos de validação (frontend e API) e o schema de preferências para aceitar os novos valores.
- Disponibilizar os rótulos dos novos presets nos três idiomas (pt-BR, en, es).
- Ampliar a constraint de banco do perfil ADVANCED (PostgreSQL) para os novos valores.
- Nenhuma remoção; `petroleum` continua fallback e padrão.

## Capabilities

### New Capabilities

<!-- nenhuma capability nova; o comportamento pertence ao catálogo de temas existente -->

### Modified Capabilities

- `theming`: o requisito **"Temas estruturais do modo claro"** passa a listar 10 presets suportados (5 atuais + `ruby`, `amber`, `amethyst`, `rose`, `silver`), mantendo `petroleum` como fallback/padrão.

## Impact

- Frontend: `apps/web/src/pages/AccountPage.tsx` (swatches), `apps/web/src/styles/globals.css` (tokens `--shell-*`), `apps/web/src/main.tsx` e `apps/web/src/contexts/AuthContext.tsx` (validação/fallback), `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json` (rótulos).
- Contratos: `packages/ui-contracts/src/index.ts` (`LightShellTheme`), `apps/api/src/validation.ts` (`preferencesSchema`) e `apps/api/src/routes/users.ts` (validação do PATCH `/api/users/me`).
- Banco: `apps/api/src/db/schema.ts` (enum SQLite) e `apps/api/src/db/postgres/schema.ts` + nova migração PostgreSQL (check `users_shell_theme_check`). SQLite não impõe CHECK, então não exige migração.
- Testes: paridade de presets (frontend/API/i18n) e aceitação/rejeição de valores no PATCH de preferências.
- Sem mudanças de rota, autenticação, dados de negócio ou dependências.
