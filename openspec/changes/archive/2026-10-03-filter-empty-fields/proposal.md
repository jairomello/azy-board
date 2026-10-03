## Why

Vários campos do cadastro de itens são opcionais (sprint, versão, responsável, autor, centro de custo). Hoje o painel `Filtros` do Board usa a mesma opção vazia (`value=""`) para representar "sem filtro" e exibe o rótulo `Sem sprint`, tornando impossível filtrar explicitamente pelos cards que **não** têm sprint ou versão. Isso impede o fluxo de triagem — por exemplo, listar todos os cards sem sprint para atribuir uma a cada um.

## What Changes

- Separar os dois estados vazios no painel `Filtros`: uma opção neutra de "sem filtro" (ex.: `Todos` / `Sem filtro`) e uma opção distinta "sem valor" (ex.: `Sem sprint`, `Sem versão`, `Não atribuído`, `Sem autor`, `Sem centro de custo`).
- Introduzir um **sentinela de valor vazio** no estado de filtros, distinto de `''` (nenhum filtro), aplicado apenas aos campos anuláveis: Sprint, Versão, Responsável, Autor e Centro de Custo.
- Aplicar o filtro por valor vazio client-side no Board: sprint vazia = item sem vínculo em `itemSprints`; versão/autor/responsável/centro de custo vazios = campo `null` no item.
- Exibir chip de filtro ativo para o filtro por valor vazio e permitir removê-lo individualmente.
- Garantir que o sentinela seja persistido em `board-filters:<projectId>` e **não** seja descartado pela limpeza de referências de catálogo inexistentes.
- Manter `Prioridade`, `Status` e `Tipo` sem opção "vazio", pois são campos `NOT NULL` no modelo de dados.

## Capabilities

### New Capabilities

_(nenhuma)_

### Modified Capabilities

- `board-filters`: novo requisito de filtro por valor vazio em campos anuláveis e ajuste do requisito do painel para distinguir "sem filtro" de "sem valor".
- `active-board-filter-chips`: chips SHALL representar e remover o filtro por valor vazio.
- `board-filters-persistence`: o estado persistido SHALL preservar o sentinela de valor vazio na restauração e na invalidação de catálogos.

## Impact

- **Frontend**: `apps/web/src/components/BoardFilters.tsx` (opções dos selects e rótulos), `apps/web/src/components/ActiveFilterChips.tsx` (normalização/remoção), `apps/web/src/features/board/BoardScreen.tsx` (predicados client-side e invalidação de catálogo), `apps/web/src/features/board/model/types.ts` (constante do sentinela).
- **i18n**: novas chaves de rótulo neutro em `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json` (reuso de `noSprint`, `noVersion`, `unassigned` para os valores vazios).
- **Testes**: testes de filtro client-side, chips ativos, persistência e contratos estruturais de UI.
- **Fora de escopo**: filtros server-side (`GET /items`, `GET /items/tree`), ferramentas MCP `list_tasks`/`update_items` e paridade `IS NULL` do adapter PostgreSQL — a triagem por valor vazio é resolvida no Board client-side.
- **Board ref**: T13 — poder fazer filtro por opção vazia (`c6c6f1bb-85dc-41ca-a27f-ffe434a551bf`)
