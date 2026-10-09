# Proposal

## Why

O protótipo de `docs/prototipos/kanban-reformulado/` apresenta uma identidade visual mais coesa para o quadro, com superfícies suaves, bordas luminosas discretas e cards cuja hierarquia facilita a leitura em listas densas. A aplicação real ainda usa estruturas e estilos diferentes, então é necessário definir como transportar essa direção para o Board sem perder seus controles, interações, temas e modos existentes.

## What Changes

- Alinhar a área de trabalho do Board — barra de comandos, filtros ativos, contexto/progresso, canvas e colunas — à composição e aos estados visuais do protótipo.
- Substituir a especificação visual atual do `KanbanCard` pela hierarquia, proporções, superfícies e estados demonstrados no protótipo, preservando campos condicionais e interações reais.
- Definir a aparência do Board em claro e escuro com tokens próprios para sua superfície, bordas, brilho e estados; manter os presets claros do shell global independentes.
- Integrar o novo visual aos layouts confortável e compacto, aos modos SIMPLE e HIERARCHICAL, à visualização em árvore e aos breakpoints existentes.
- Preservar filtros, criação, arraste, edição, detalhe, permissões de ações, acessibilidade, traduções e persistência já disponíveis.

## Capabilities

### New Capabilities

- `board-visual-presentation`: composição visual da área de trabalho do Board, incluindo canvas e colunas, estados, integração temática e adaptação responsiva.

### Modified Capabilities

- `kanban-card-layout`: atualizar o contrato visual do card para corresponder ao protótipo e definir a compatibilidade temática e de estados para os dados reais.
- `board-compact-density`: adaptar as regras de densidade confortável/compacta para a nova composição sem remover campos ou controles existentes.

## Impact

- Frontend: `apps/web/src/features/board/BoardScreen.tsx`, `apps/web/src/features/board/components/BoardColumns.tsx`, `apps/web/src/components/KanbanCard.tsx`, `BoardCommandBar.tsx`, `BoardContext.tsx` e estilos/tokens em `apps/web/src/styles/globals.css`.
- Contratos de comportamento: `openspec/specs/kanban-card-layout/`, `openspec/specs/board-compact-density/` e a nova capacidade `board-visual-presentation/`.
- O shell global (`AppShell`), preferências de tema e APIs não precisam mudar; a proposta limita a reformulação à área de trabalho do Board e seus componentes.
