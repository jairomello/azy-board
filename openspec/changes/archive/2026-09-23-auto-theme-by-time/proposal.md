## Why

Hoje o tema claro/escuro é fixo: definido pelo usuário (ou pela preferência do SO na primeira visita) e só muda por ação manual. Quem alterna naturalmente entre dia e noite precisa trocar o tema todos os dias. O card T4 pede uma opção de o tema acompanhar o horário do computador, sem perder a preferência manual.

## What Changes

- Adicionar, nas preferências do usuário, um toggle "Tema automático por horário", desligado por padrão.
- Com o toggle **desligado**: comportamento atual inalterado — o tema é o salvo em `localStorage['theme']`/`users.theme`, sem consultar horário.
- Com o toggle **ligado**: a cada acesso a aplicação lê a hora local do computador e escolhe o tema — **claro durante o dia** e **escuro à noite**.
- Persistir a preferência no usuário (novo campo booleano) e espelhá-la no `localStorage` para aplicação antes do primeiro render, sem flash.
- Preservar o tema manual anterior: não sobrescrever `localStorage['theme']` enquanto o modo automático estiver ativo; ao desligar, restaurar o tema manual.
- Reavaliar o tema quando a aba volta a ficar visível/recebe foco e na virada de faixa com a aplicação aberta.
- Enquanto o automático estiver ligado, o seletor manual Claro/Escuro fica desabilitado com dica de contexto.
- Traduzir os novos textos em pt-BR, en e es.

Faixas padrão (constantes, nesta entrega): dia = 06:00–17:59:59 → claro; noite = 18:00–05:59:59 → escuro, com base na hora local do computador.

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova: o comportamento pertence à capability de tema existente. -->

### Modified Capabilities
- `theming`: novo requisito de tema automático por horário, incluindo persistência/sincronização do toggle, aplicação pré-render sem flash, reavaliação de faixa e interação com o seletor manual.

## Impact

- **Contratos:** `packages/types/src/index.ts` (campo `autoThemeByTime` no `User`).
- **Banco:** `apps/api/src/db/schema.ts` (`auto_theme_by_time` booleano, default `false`) + migration append-only.
- **API:** `apps/api/src/routes/users.ts` (allowlist, validação e resposta do `PATCH /users/me`) e `apps/api/src/routes/auth.ts` (login/`/auth/me`).
- **Web:** `apps/web/src/main.tsx` (bootstrap pré-render), `apps/web/src/contexts/AuthContext.tsx` (`PreferenceUpdate`/`applyPreferences`), `apps/web/src/pages/AccountPage.tsx` (toggle), `apps/web/src/i18n/locales/*/settings.json`.
- **Rastreabilidade:** Board ref: ac405cb3-e7dd-42d4-baaf-7f836ece5492 (card T4).
- **Fora de escopo:** faixas customizáveis, cálculo por nascer/pôr do sol e tema por projeto.
