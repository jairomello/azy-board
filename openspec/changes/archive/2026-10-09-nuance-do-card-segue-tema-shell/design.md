# Design

## Context

Ver `proposal.md — Why`. Em `apps/web/src/styles/globals.css`, o Board define `--board-glow-a/-b/-c` (ciano/violeta) usados tanto pelo Chrome do Board (`.board-canvas`, `.board-column*`, `.board-command-bar`, `.board-context-header`, etc.) quanto pelo card (`.kanban-card`: fundo `color-mix(..., var(--board-glow-a) 6%, ...)`, borda, anel de sombra e hover). Os presets claros (`:root[data-light-shell-theme="..."]`) hoje só definem tokens `--shell-*`. O modo escuro define seus próprios tokens em `:root.dark` e `.dark .kanban-card` sobrescreve fundo/borda/sombra do card.

## Goals / Non-Goals

**Goals:**
- Fazer a nuance de fundo, a borda e o realce sutil do card, no **modo claro**, acompanhar o preset de shell escolhido.
- Manter canvas, colunas, barra de comandos, filtros e contexto independentes dos presets (escopo "só o card").
- Não alterar o modo escuro, o contraste de texto nem o comportamento/densidade do card.

**Non-Goals:**
- Criar presets novos ou alterar a lista/rótulos de temas.
- Recolorir o chrome do Board.
- Alterar dados, ações, acessibilidade ou estado de arraste.

## Decisions

### Tokens de card dedicados, desacoplados do chrome

Introduzir `--board-card-glow-a` e `--board-card-glow-b` (defaults neutros no `:root` claro, iguais aos atuais ciano/violeta) e sobrescrevê-los em cada bloco `:root[data-light-shell-theme="..."]`. As regras do `.kanban-card` (fundo, borda, anel de sombra e hover) passam a usar **os tokens do card**; o chrome continua usando `--board-glow-*`.

- Alternativa considerada: sobrescrever `--board-glow-a/-b` por preset. Rejeitada porque retingiria o Board inteiro (canvas/colunas/comando), contrariando o escopo "só o card" definido com o usuário.

### Aplicação somente no modo claro

Os tokens do card entram apenas na regra base `.kanban-card` (camada `components`). No escuro, `.dark .kanban-card` já sobrescreve fundo/borda/sombra com valores próprios, então os tokens do card não produzem efeito — o card escuro fica idêntico ao atual. O pseudo-elemento `::after` (brilho externo) permanece com `--board-glow-*`, pois é recortado por `overflow: hidden` do card e não afeta a percepção.

- Alternativa considerada: definir também `--board-card-glow-*` no `.dark`. Desnecessária, pois as regras escuras do card vencem; mantém a mudança mínima.

### Paletas por preset (tom sutil, casado ao shell)

| Preset | card-glow-a | card-glow-b |
|---|---|---|
| `petroleum` (default) | #2fc6d7 | #4fd8c4 |
| `ocean` | #4aa3ff | #67c7ff |
| `emerald` | #35c99a | #69e0b5 |
| `graphite` | #8b7dff | #a99fff |
| `classic` | #7c6dff | #b0a4ff |
| `ruby` | #ff6b81 | #ff9e7a |
| `amber` | #ffab44 | #ffcf6b |
| `amethyst` | #a97bff | #c9a6ff |
| `rose` | #ff7fb4 | #ffa9cf |
| `silver` | #8fa0b3 | #b9c4d1 |

A nuance é aplicada em baixa opacidade (tint de 12% no fundo, 28% na borda) — suficiente para a variação por tema ser perceptível sem tornar o card colorido demais. O texto do card continua em `--card-foreground`, sem mudança de contraste. (Os valores foram elevados de 6%/20% para 12%/28% após a verificação: com 6% o fundo ficava quase branco e a variação por tema não era visível.)

## Risks / Trade-offs

- [Card colorido sobre canvas neutro (cinza-azulado) pode gerar leve descompasso] → tint em baixa opacidade; validar nos temas quentes (Vermelho, Laranja) e frios.
- [Tons muito saturados no claro] → usar opacidades baixas e validar legibilidade dos textos/tags.
- [Vazamento para o modo escuro] → tokens só na regra base; conferir que `.dark` mantém o card atual.
- [Manutenção de 10 pares de tokens] → documentados na tabela e cobertos por tarefa de verificação; o default cobre `petroleum`.

## Migration Plan

1. Adicionar `--board-card-glow-a/-b` no `:root` claro e nos blocos de preset.
2. Apontar as regras do `.kanban-card` para os tokens do card (fundo, borda, anel, hover), sem tocar em `--board-glow-*`.
3. Verificar claro (vários presets) e escuro; rodar typecheck/build e testes.

Rollback: restaurar as regras do `.kanban-card` para `--board-glow-*` e remover os tokens do card; sem migração de dados.
