# Proposal

## Why

No modo claro, o fundo do card do Kanban tem uma nuance azul-gelo/cinza-azulado fixa (derivada de `--board-glow-a`, hoje ciano). Ao trocar o **Tema do shell claro** (Petróleo, Vermelho, Roxo, Prata, etc.), a nuance do card **não acompanha** a cor escolhida, o que gera um descompasso entre o shell e os cards. Fazer o card acompanhar o tema escolhido deixa a experiência mais coerente e personalizada.

## What Changes

- No **modo claro**, a nuance de fundo, a borda e o realce sutil do card passam a derivar do preset de shell claro ativo, via tokens próprios do card (ex.: `--board-card-glow-a`/`--board-card-glow-b`) definidos por preset.
- O **restante do Board** (canvas, colunas, barra de comandos, filtros, contexto) **permanece como está** — apenas o card varia.
- No **modo escuro**, o card mantém a paleta escura própria do Board (sem variação por preset).
- Nenhum preset novo, alteração de API, dados ou comportamento de card (dados, ações, densidade intactos).

## Capabilities

### New Capabilities

<!-- nenhuma capability nova -->

### Modified Capabilities

- `board-visual-presentation`: o requisito **"Paleta do Board nos temas claro e escuro"** deixa de declarar o card totalmente independente dos presets claros; passa a indicar que, no modo claro, a nuance/borda/realce do **card** acompanha o preset escolhido, enquanto as demais superfícies do Board permanecem independentes (e o modo escuro não varia).

## Impact

- Frontend: `apps/web/src/styles/globals.css` — novos tokens `--board-card-glow-*` (defaults e por preset claro) e ajuste das regras `.kanban-card` (fundo, borda, sombra/hover) para usá-los; modo escuro preservado.
- Sem impacto em APIs, banco, i18n, dados de card, densidade ou acessibilidade.
