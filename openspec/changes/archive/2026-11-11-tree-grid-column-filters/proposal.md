# Proposal

## Why

O PR #11 entregou filtros diretos no cabeçalho da grade da Tree View, ação visível de limpar filtros e criação inline abaixo da linha, além do desfazer no arquivamento. Nada disso foi registrado em OpenSpec, então a spec não descreve o comportamento publicado.

## What Changes

- Documentar os filtros por coluna de cabeçalho na Tree View (status, responsável, prioridade, sprint, versão e centro de custo), combinados com os filtros do board.
- Documentar a ação de limpar filtros com contador de ativos, preservando as preferências de exibição do board e da Tree View.
- Documentar a criação inline abaixo da linha, respeitando hierarquia e permissões.
- Documentar o desfazer do arquivamento exibido no toast após a ação.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `tree-view`: filtros por coluna, limpar filtros e criação inline.
- `board-filters`: ação de limpar filtros visível com contador de ativos.
- `card-archive`: desfazer temporário do arquivamento.

## Impact

- Frontend: `TreeViewPage.tsx`, `BoardFilters.tsx`, `BoardCommandBar.tsx`, `useBoardArchiving.ts`, `Toast.tsx`.
- Testes: filtros por coluna, command bar, toast e arquivamento.
