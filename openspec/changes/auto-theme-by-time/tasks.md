## 1. Backend e contratos

- [x] 1.1 Adicionar `autoThemeByTime: boolean` ao tipo `User` em `packages/types`
- [x] 1.2 Adicionar a coluna `auto_theme_by_time` (booleano, default `false`) em `apps/api/src/db/schema.ts` com migration append-only e guarda de integridade
- [x] 1.3 Incluir o campo na allowlist e na validação booleana de `PATCH /users/me` em `apps/api/src/routes/users.ts`
- [x] 1.4 Retornar `autoThemeByTime` no login e em `/auth/me` (`apps/api/src/routes/auth.ts`)

## 2. Lógica de tema no frontend

- [x] 2.1 Criar util de tema no web com as constantes `DAY_START_HOUR`/`NIGHT_START_HOUR` e a função pura `getEffectiveTheme({ auto, manual, date })`
- [x] 2.2 Adicionar teste de unidade cobrindo dia, noite, limites `06:00`/`18:00` e valor automático desligado
- [x] 2.3 Atualizar `apps/web/src/main.tsx` para resolver o tema efetivo antes do primeiro render, lendo o flag de `localStorage` e sem sobrescrever `theme`
- [x] 2.4 Estender `PreferenceUpdate`/`applyPreferences` em `apps/web/src/contexts/AuthContext.tsx` para persistir o flag e reaplicar o tema efetivo
- [x] 2.5 Reavaliar o tema ao carregar, em `focus`/`visibilitychange` e em intervalo de 60s enquanto o modo automático estiver ativo

## 3. UI e i18n

- [x] 3.1 Adicionar o toggle "Tema automático por horário" na seção de aparência de `apps/web/src/pages/AccountPage.tsx`
- [x] 3.2 Desabilitar o seletor manual Claro/Escuro enquanto o automático estiver ligado, exibindo o valor manual e uma dica
- [x] 3.3 Adicionar as chaves de i18n em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`
- [x] 3.4 Garantir acessibilidade do toggle (role/aria-checked e foco por teclado)

## 4. Verificação

- [x] 4.1 Rodar `bun run check` (typecheck + lint + testes + build)
- [x] 4.2 Rodar `bun run test:migrations` para validar a nova migration
- [x] 4.3 Validar manualmente: desligado mantém o tema salvo; ligado aplica claro de dia e escuro à noite; desligar restaura o tema manual; sem flash ao recarregar
- [x] 4.4 Validar `openspec validate` da change e registrar o vínculo e o fechamento no card do board
