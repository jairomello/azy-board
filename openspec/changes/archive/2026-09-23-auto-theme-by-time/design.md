## Context

O tema atual é resolvido em `apps/web/src/main.tsx` antes do primeiro render: lê `localStorage['theme']`; se ausente/inválido, usa `prefers-color-scheme` e persiste. Depois disso, o tema só muda pelo toggle manual em `AccountPage`, que chama `updatePreferences` (`PATCH /api/users/me`) e atualiza `localStorage` e a classe `dark` do `<html>`. O usuário tem os campos `theme` e `lightShellTheme` no banco, mapeados em `packages/types` e validados em `apps/api/src/routes/users.ts`. A spec `theming` cobre claro/escuro e presets do shell claro.

## Goals / Non-Goals

**Goals:**

- Toggle de "tema automático por horário" nas preferências, sincronizado entre dispositivos.
- Tema efetivo calculado pela hora local do computador, claro de dia e escuro à noite, sem flash.
- Manter o comportamento atual quando o toggle está desligado e preservar a preferência manual.
- Reavaliar na virada de faixa com a aplicação aberta.

**Non-Goals:**

- Faixas customizáveis pelo usuário ou cálculo por nascer/pôr do sol/API externa.
- Tema por projeto/workspace.
- Mudar a detecção de `prefers-color-scheme` da primeira visita, que continua como ponto de partida do tema manual.

## Decisions

### Constantes e função pura de resolução

Criar um util de tema no web com as constantes `DAY_START_HOUR = 6` e `NIGHT_START_HOUR = 18` e uma função pura `resolveThemeByTime(date)` que retorna `'dark'` quando a hora local não está no intervalo diurno e `'light'` caso contrário, além de `getEffectiveTheme({ auto, manual, date })`. Isso mantém a regra testável em unidade, sem depender do DOM. Alternativa considerada: embutir a lógica em `main.tsx` (rejeitada por dificultar teste e reutilização).

### Persistência: banco + espelho local

Novo campo booleano `autoThemeByTime` no usuário (coluna `auto_theme_by_time`, default `false`) para sincronizar entre dispositivos, e espelho em `localStorage['theme-auto-by-time']` para permitir o cálculo antes do primeiro render. A preferência manual continua em `localStorage['theme']`/`users.theme` e **não** é sobrescrita pelo valor calculado. Alternativa considerada: guardar apenas no `localStorage` (rejeitada por não sincronizar entre dispositivos, contrariando o padrão atual das preferências).

### Pré-render e reavaliação

`main.tsx` resolve o tema efetivo considerando o modo automático antes de renderizar. Um efeito (em `AuthContext` ou hook dedicado) reaplica o tema: ao carregar, ao receber `focus`/`visibilitychange` e em intervalo curto (60s) enquanto o modo automático estiver ativo. Alternativa considerada: só avaliar no carregamento (rejeitada: ficaria com o tema errado após a virada com a aba aberta).

### UI e interação com o seletor manual

O toggle fica na seção de aparência de `AccountPage`. Enquanto ligado, o seletor manual Claro/Escuro é desabilitado com dica textual; o valor manual permanece selecionado e é restaurado ao desligar. Alternativa considerada: permitir ajuste manual que desliga o automático automaticamente (rejeitada por ser uma ação implícita surpreendente).

### Contratos e API

Adicionar `autoThemeByTime` a `User` em `packages/types`, à allowlist e à validação de `PATCH /users/me` (booleano estrito) e às respostas de login/`/auth/me`. Migração append-only seguindo a política do repositório.

## Risks / Trade-offs

- **Relógio do computador errado** → o tema segue a hora local; comportamento previsível e explicitado na UI, sem correção automática.
- **Virada de faixa com aba aberta** → mitigado pela reavaliação periódica e por foco/visibilidade.
- **Flash ao carregar** → mitigado pela leitura do espelho de `localStorage` antes do primeiro render.
- **Duplicação de regra entre pré-render e efeito** → mitigado pela função pura compartilhada entre `main.tsx` e o hook de reavaliação.
- **Fuso na virada de faixa** → usa a hora local do dispositivo; sem dependência de servidor.

## Migration Plan

1. Adicionar o campo `auto_theme_by_time` (default `false`) com migration append-only e guarda de integridade.
2. Estender `packages/types`, `users.ts` e `auth.ts`.
3. Criar o util de tema com a função pura e testes de unidade.
4. Atualizar `main.tsx`, `AuthContext` e `AccountPage`, mais as chaves de i18n.
5. Rollback: reverter o código e deixar a coluna (compatível, default `false`); nenhum dado de usuário é perdido.

## Open Questions

- Faixas 06:00/18:00 devem virar preferência do usuário em uma iteração futura? Recomendação: manter constantes nesta entrega.
- O intervalo de reavaliação deve ser 60s ou alinhado ao próximo limite? Recomendação: 60s, simples e suficiente.
