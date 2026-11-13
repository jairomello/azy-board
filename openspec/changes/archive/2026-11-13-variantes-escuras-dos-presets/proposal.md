# Proposal

## Why

No modo escuro, o Azy Board ignora o preset de cor escolhido e cai sempre na mesma paleta azulada fixa: canvas, colunas e cards misturam preto, cinza e azul sem coesão, enquanto o modo claro já oferece dez presets harmonizados. Os protótipos aprovados em `docs/prototipos/temas-escuros/` (Grafite e Ameixa) mostram que o mesmo preset pode governar os dois modos, com superfícies tonificadas, degradês, reflexos e brilho de contorno — visual mais coeso sem perder legibilidade.

## What Changes

- Cada um dos dez presets existentes (`petroleum`, `ocean`, `emerald`, `graphite`, `classic`, `ruby`, `amber`, `amethyst`, `rose`, `silver`) passa a definir também uma variante escura completa: tokens globais (`--background`, `--card`, `--primary`, `--border`, …), tokens do shell (`--shell-*`) e tokens do Board (`--board-*`).
- A escolha de preset passa a valer nos dois modos: o mesmo preset selecionado em Aparência decide o shell claro e o shell/Board escuros. **BREAKING** para a regra atual de que o modo escuro ignora o preset claro.
- O modo escuro ganha o acabamento do protótipo: canvas com halo radial, colunas e cabeçalhos com degradê tonificado, cards com gradiente sutil, contorno luminoso, sombra profunda e realce no hover/foco; barras de progresso do Board usam o gradiente do preset.
- O visual claro permanece como está: presets, superfícies e cards claros não mudam.
- O seletor de Aparência passa a refletir os dois modos (rótulo e amostra deixam de sugerir "somente claro"), sem novo campo de preferência nem migração de banco.
- Nenhuma mudança de API, de schema ou de contrato de persistão: `lightShellTheme` continua sendo o único valor salvo.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `theming`: os presets passam a descrever variantes claras **e** escuras, com o mesmo valor governando os dois modos; a persistência e o seletor de Aparência acompanham essa semântica.
- `board-visual-presentation`: no modo escuro, o card e as superfícies do Board passam a acompanhar o preset ativo e recebem degradês, reflexos e brilho de contorno do protótipo, em vez da paleta escura fixa.

## Impact

- Frontend: `apps/web/src/styles/globals.css` (tokens por preset no modo escuro e efeitos `.dark`), `apps/web/src/lib/shellThemes.ts` (amostras por modo), `apps/web/src/pages/AccountPage.tsx` (seletor de Aparência), i18n de `settings` nos três idiomas e testes de paridade de temas.
- API/banco: nenhum campo novo; `lightShellTheme`, `theme` e `autoThemeByTime` mantêm o contrato atual.
- Documentação: referência aos protótipos em `docs/prototipos/temas-escuros/` como fonte visual aprovada.

## Assumptions

- `lightShellTheme` mantém o nome no banco e no contrato por compatibilidade, mesmo passando a governar os dois modos; renomear exigiria migração sem ganho funcional.
- O valor padrão continua `petroleum`; a variante escura de `petroleum` vira a paleta escura padrão, substituindo a azulada fixa atual.
- As cores semânticas de status (`--status-*`) e dos gráficos do Dashboard preservam o significado (azul = andamento, verde = concluído, vermelho = bloqueado) e são apenas reajustadas em saturação/luminosidade para cada fundo escuro, sem virar decoração do preset.
- A abrangência visual desta change é shell + Board, como nos protótipos; modais, formulários, Dashboard e árvore apenas herdam os tokens globais sem redesenho dedicado.
- O tema automático por horário continua escolhendo claro/escuro; o preset segue sendo um só para os dois modos.

## Referência no Azy Board

Board ref: `T90` — item `a7ab0895-f7c6-4682-bee4-4b45c8adff68` (projeto Azyboard).
