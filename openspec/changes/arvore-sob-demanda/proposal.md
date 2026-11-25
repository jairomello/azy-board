# Proposal

## Why

O chunk `BoardPage` estava a 0,08 KB do teto (60,96 de 61,04 KB gzip) e as
próximas mudanças do redesenho do board (visão lembrada, menu Exibir, filtros
em dois níveis) somam cerca de +3,5 KB nele. Em vez de subir o orçamento, a
decisão foi tirar do chunk o que nem toda visita usa.

A `TreeViewPage` (grade com colunas configuráveis, edição inline e criação
entre linhas) era importada de forma estática pelo `BoardScreen` e, por isso,
quem abria só o Kanban ou o Unificado baixava a Árvore inteira junto.

## What Changes

- A `TreeViewPage` passa a ser carregada sob demanda (`React.lazy`) quando a
  visão Árvore é exibida. Enquanto o chunk chega, o canvas mostra um indicador
  de carregamento (`role="status"`).
- O orçamento ganha uma regra própria para o novo chunk `TreeViewPage`
  (13000 bytes gzip). Os tetos existentes não mudam.

Medido no build de produção: `BoardPage` 60,96 → 50,26 KB gzip;
`TreeViewPage` 12,15 KB; `index` inalterado (101,98 KB).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `web-bundle-budget`: novo requisito de carregamento sob demanda da visão
  Árvore do board.

## Impact

- `apps/web/src/features/board/BoardScreen.tsx` (import sob demanda e
  `Suspense` em volta da Árvore).
- `apps/web/bundle-budget.json` (regra do chunk `TreeViewPage`).
- Sem mudança de contrato REST, MCP, banco ou migration. A Árvore mantém as
  mesmas props e o mesmo comportamento depois de carregada.
