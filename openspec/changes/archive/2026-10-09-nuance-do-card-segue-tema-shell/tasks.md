# Tasks

## 1. Tokens e regras do card

- [x] 1.1 Em `apps/web/src/styles/globals.css`, adicionar `--board-card-glow-a` e `--board-card-glow-b` no `:root` claro (defaults = par de `petroleum`) e sobrescrevê-los em cada bloco `:root[data-light-shell-theme="ocean|emerald|graphite|classic|ruby|amber|amethyst|rose|silver"]` conforme a tabela do `design.md`. Verificar que os tokens do chrome (`--board-glow-*`) permanecem intactos.
- [x] 1.2 Apontar as regras de `.kanban-card` (fundo/gradiente, borda, anel de sombra e hover na camada `components`) para `--board-card-glow-a/-b`, sem alterar `.dark .kanban-card`. Verificar no modo claro que trocar de preset muda apenas a nuance do card, e no modo escuro que o card permanece igual ao atual.

## 2. Verificação

- [x] 2.1 Rodar `bun run typecheck`, `bun run test:web` e `bun run check:frontend-tests`. Conferir visualmente, no modo claro, ao menos 4 presets (ex.: Petróleo, Vermelho, Roxo, Prata) e o modo escuro.
- [x] 2.2 Confirmar que canvas, colunas, barra de comandos, filtros e contexto **não** variam com o preset (apenas o card) e que o contraste/legibilidade do texto, tags e borda do card se mantém nos temas claro e escuro.

## Workflow follow-up

- Executar `bun run check` e `bun run test:smoke` ao concluir, conforme o repositório.
- Se o trabalho for vinculado a um card do Azy Board, registrar `Board ref: <itemId>` e fechar o card com `complete_task`.
