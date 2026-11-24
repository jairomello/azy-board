# Tasks

## 1. Medição e reprojeção

- [x] 1.1 Registrar na medição do arraste os containers roláveis (canvas e faixa de colunas de cada lane) com `scrollLeft`/`scrollTop` iniciais.
- [x] 1.2 Adicionar `scrollDeltaSince` e `adjustPointerForScroll` ao modelo puro da animação.
- [x] 1.3 Reprojetar o ponteiro pela rolagem em `onDragMove`, `onDragEnd` e no recálculo disparado por `scroll`.

## 2. Prévia durante a rolagem

- [x] 2.1 Escutar `scroll` dos containers durante o arraste e recalcular a prévia com o último deslocamento do ponteiro.
- [x] 2.2 Remover os ouvintes na soltura, no cancelamento e ao iniciar um novo arraste.

## 3. Testes

- [x] 3.1 Unitários: soma de rolagem em containers aninhados, rolagem zero e reprojeção nos dois eixos.
- [x] 3.2 Hook: rolar sem mover o ponteiro muda a coluna da vaga; soltura usa a coluna reprojetada; ouvintes são removidos.
- [x] 3.3 E2E: no Unificado com viewport estreito, a faixa rola, a vaga acompanha a coluna visível e a soltura persiste essa coluna.

## 4. Verificação

- [x] 4.1 Rodar `bun run check` e `bun run test:smoke`.
- [x] 4.2 Rodar `bun run e2e/drag-animation.ts` (cenários 1–7 verdes).
- [x] 4.3 Validar `bun run openspec:validate` e `bun run check:docs`.
