## Context

O Board aplica filtros client-side sobre `displayedTasks`, usando um estado de filtros com escalares do tipo `string` em que `''` significa "sem filtro" (`DEFAULT_FILTERS` em `apps/web/src/features/board/model/types.ts`). Os selects em `BoardFilters.tsx` também usam `<option value="">` para o estado neutro, mas rotulam essa opção com `noSprint` ("Sem sprint") no filtro de Sprint — fundindo "sem filtro" com "sem valor". O filtro de Versão usa o rótulo `filterVersion` ("Versão") e o de Responsável usa `filterAssignee` ("Responsável"); nenhum deles oferece uma opção para "sem valor".

Consequência: não há como listar apenas cards sem sprint/versão/responsável. A triagem (abrir cada card sem sprint para atribuir uma) fica impossível. Campos filtráveis e nulidade no modelo: `sprintId` (tabela de junção `item_sprints`), `versionId`, `assigneeId`, `authorId` e `costCenterId` são anuláveis; `priority`, `status` e `type` são `NOT NULL`.

## Goals / Non-Goals

**Goals:**
- Distinguir explicitamente "sem filtro" de "sem valor" nos filtros de Sprint, Versão, Responsável, Autor e Centro de Custo.
- Permitir filtrar os cards sem valor nesses cinco campos, com chip de filtro ativo e remoção individual.
- Persistir e restaurar o filtro por valor vazio sem que a limpeza de catálogos o descarte.

**Non-Goals:**
- Não alterar filtros server-side (`GET /items`, `GET /items/tree`) nem o adapter PostgreSQL (`IS NULL`).
- Não adicionar opção vazia para `priority`, `status` ou `type` (`NOT NULL`).
- Não alterar o filtro de Módulo, Squad ou Tags.
- Não mudar o comportamento de ferramentas MCP (`list_tasks`/`update_items`).
- Não migrar dados de itens.

## Decisions

### Decisão 1: Sentinela de valor vazio no estado de filtros

**Escolha:** manter o estado como `string` e introduzir uma constante `EMPTY_FILTER_VALUE = '__empty__'` em `apps/web/src/features/board/model/types.ts`, com o helper `isEmptyFilterValue(value)`. Os predicados passam a ter três estados por campo: `''` = sem filtro; `EMPTY_FILTER_VALUE` = apenas vazios; qualquer outro valor = correspondência exata.

**Alternativas consideradas:**
- **Flags booleanas separadas** (`filterEmptySprint`, ...): duplicaria o estado e a persistência, e quebraria a composição "um valor por campo".
- **Trocar o tipo para `string | null` com `null` = filtro vazio**: espalharia a mudança por todos os selects e pela persistência, sem ganho sobre o sentinela.
- **Valor especial por campo** (`'none'`, `'unassigned'`): mais fácil colidir com dados reais e menos consistente.

**Rationale:** o sentinela preserva o formato atual (`string`), é persistível em `localStorage` sem migração e não colide com IDs UUID do catálogo. O prefixo/segmento `__` o torna improvável como ID legítimo.

### Decisão 2: Campos elegíveis ao valor vazio

Aplicar o sentinela apenas a campos anuláveis: Sprint, Versão, Responsável, Autor e Centro de Custo. `Prioridade`, `Status` e `Tipo` permanecem sem opção vazia. Módulo fica fora do escopo (semântica de épico sem módulo é ambígua e o filtro de módulo é aplicado aos épicos, não aos cards folha).

### Decisão 3: Rotulagem das opções

Cada select passa a ter duas opções de "vazio":
- Neutra (sem filtro): `value=""`, rótulo neutro — Sprint usa `allSprints` ("Todas"); Versão, Responsável, Autor e Centro de Custo usam o rótulo do campo (`filterVersion`, `filterAssignee`, `filterAuthor`, `filterCostCenter`).
- Valor vazio: `value="__empty__"`, rótulo `noSprint`, `noVersion`, `unassigned`, `noAuthor`, `noCostCenter`.

Novas chaves i18n: `noAuthor` e `noCostCenter` em `pt-BR`, `en` e `es`. As chaves `noSprint`, `noVersion` e `unassigned` já existem e passam a valer apenas para o sentinela.

### Decisão 4: Predicados client-side

Em `BoardScreen.tsx`, extrair predicados nomeados para cada campo e aplicá-los tanto em `boardCards` quanto no bloco de histórias folha:
- Sprint vazio: `!item.itemSprints?.length`
- Versão vazia: `!item.versionId`
- Responsável vazio: `!item.assigneeId`
- Autor vazio: `!item.authorId`
- Centro de custo vazio: `!item.costCenterId`

### Decisão 5: Chips e contagem

`EMPTY_FILTER_VALUE` é truthy, então já entra na contagem de filtros ativos e no `activeCount` sem mudança. `normalizeActiveBoardFilters` (`ActiveFilterChips.tsx`) deve emitir o chip do campo com o rótulo "sem valor" quando `isEmptyFilterValue(value)`; `removeActiveBoardFilter` já restaura `''`. A remoção continua limpando apenas o valor do campo.

### Decisão 6: Persistência e invalidação de catálogo

`useBoardPreferences` grava o estado como JSON, então o sentinela é persistido sem mudança. A invalidação de referências inexistentes (`BoardScreen.tsx`: versão, sprint e centro de custo) SHALL ignorar `EMPTY_FILTER_VALUE`, para não limpar o filtro por valor vazio ao carregar o board.

## Risks / Trade-offs

- **[Risco] Colisão do sentinela com ID real** → UUIDs de catálogo não produzem `__empty__`; o helper centraliza a checagem, e testes cobrem igualdade exata.
- **[Risco] Persistência de estado antigo** → `''` continua significando sem filtro; nenhuma migração é necessária e campos desconhecidos seguem ignorados.
- **[Risco] Semântica confusa em Autor/Responsável** → rótulos explícitos ("Não atribuído", "Sem autor") e chips deixam claro o filtro aplicado.
- **[Trade-off] Divergência com filtros server-side** → Tree view e MCP não ganham valor vazio; documentado como não-objetivo para não expandir o escopo.
- **[Trade-off] Módulo fora do escopo** → quem precisar de "épicos sem módulo" não é atendido agora.
