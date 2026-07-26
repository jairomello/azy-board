## Why

O tema já é salvo no `localStorage` quando o usuário clica no toggle. Porém, na **primeira abertura sem entrada salva**, o sistema detecta a preferência do SO via `prefers-color-scheme` mas não a grava imediatamente. Se o SO mudar de tema (ex.: agendamento automático claro/escuro do macOS ou Windows), na próxima abertura da aplicação o tema muda sem que o usuário tenha pedido. O usuário perde o controle: o tema deve mudar apenas quando ele clicar no toggle.

## What Changes

- Em `main.tsx`, ao detectar que não há entrada no `localStorage`, a preferência do SO é lida **e imediatamente gravada** em `localStorage['theme']` — tornando-a a escolha inicial explícita do usuário
- A partir desse momento, mudanças na preferência do SO são ignoradas; o tema só muda via toggle

## Capabilities

### New Capabilities
- (nenhuma nova — melhoria de comportamento em capability existente)

### Modified Capabilities
- `theming`: o cenário "Respeito à preferência do sistema operacional" é refinado — a preferência do SO é usada apenas **uma vez** como ponto de partida, sendo imediatamente persistida; mudanças posteriores no SO não afetam o tema da aplicação

## Impact

- **Frontend**: `apps/web/src/main.tsx` — 3 linhas alteradas no bloco de inicialização de tema (antes do primeiro render)
- **API / banco**: sem alteração
- **Retrocompatibilidade**: usuários com `localStorage['theme']` já definido não são afetados (caminho existente, sem mudança)
