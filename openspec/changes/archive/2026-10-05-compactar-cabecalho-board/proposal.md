## Why

Na tela de Board, o topo consome muito espaço vertical: a barra de controles (~54 px), a linha de chips de filtros ativos e o painel **"Progresso Geral"** ficam empilhados acima das colunas, empurrando os cards para baixo. O card **T33 — Layout - opção para otimizar o espaço** pede uma opção que privilegie a área dos cards, mantendo o layout atual como padrão.

Além disso, foi identificada uma **regressão**: o controle de densidade existente (Confortável/Compacta) **não produz mais efeito** desde a reformulação dos cards (T32) — a regra `.density-compact .kanban-card-content` (em `apps/web/src/styles/globals.css`) mira uma classe que o `KanbanCard` reescrito deixou de usar.

**Decisão:** em vez de criar um segundo controle, **reaproveitar o botão de densidade existente**. `Confortável` = layout atual (padrão); `Compacta` = **cabeçalho super compacto + cards densos**, no mesmo acionamento. E **corrigir a compactação dos cards** para que o botão volte a ter efeito visível.

**Board ref:** `4741c2c8-e3bb-4a10-8327-aab11f9baf1d` (T33 - Layout - opção para otimizar o espaço, coluna "Backlog").

## What Changes

- **Sem novo controle**: o toggle de densidade existente passa a controlar **cabeçalho e cards**. `Confortável` (padrão) mantém o layout atual; `Compacta` aplica o modo denso completo.
- **Correção da densidade dos cards (regressão pós-T32)**: reintroduzir o gancho de densidade na estrutura atual do `KanbanCard` e ajustar as regras CSS para reduzir preenchimento e espaçamento entre regiões, tornando o efeito visível sem remover informações do card.
- **Cabeçalho super compacto** no estado Compacta: reduz a altura e as margens da barra de controles; **substitui o painel "Progresso Geral"** por um indicador fino que mantém percentual e contagem; **resume a linha de chips de filtros ativos** em um controle na barra, com lista completa e remoção individual sob demanda; reduz os espaçamentos (`gap`) do topo.
- **Espaço liberado vai para os cards**, que também ficam mais densos — priorizando a leitura do Kanban.
- **Acessibilidade e clareza**: o controle expõe estado (`aria-pressed`), rótulo traduzido e foco visível; filtros continuam removíveis por teclado no modo compacto.
- **Sem BREAKING**: `Confortável` (default) mantém exatamente o comportamento atual; a densidade continua persistida como hoje.

**Fora de escopo:** alterar a altura do cabeçalho global (`AppShell`), mudar a persistência da densidade (global → por projeto), redesenhar colunas ou a árvore.

## Capabilities

### New Capabilities

- `board-compact-density`: modo compacto do Board acionado pelo controle de densidade — significado dos estados (Confortável padrão / Compacta), compactação efetiva dos cards e regras do cabeçalho super compacto (barra, progresso e filtros).

### Modified Capabilities

- `active-board-filter-chips`: a linha de filtros ativos ganha apresentação compacta no modo denso, resumida na barra de controles com acesso à lista completa e remoção individual preservadas.

## Impact

- **Web**: `apps/web/src/components/KanbanCard.tsx` (reintroduzir o gancho de densidade na estrutura atual), `apps/web/src/styles/globals.css` (regras de compactação compatíveis com a nova estrutura), `apps/web/src/components/BoardCommandBar.tsx` (resumo de filtros e semântica do controle), `apps/web/src/components/BoardContext.tsx` (indicador fino de progresso), `apps/web/src/components/ActiveFilterChips.tsx` (apresentação compacta), `apps/web/src/features/board/BoardScreen.tsx` e `apps/web/src/components/AppShell.tsx` (espaçamentos do topo).
- **i18n**: `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json` (rótulos do resumo de filtros; a densidade já é traduzida).
- **Testes**: contrato estrutural do efeito da densidade (classe/estado no card e no topo) e verificação `bun run check`, `test:smoke`, `check:bundle`.
- **Sem impacto de backend/API** e **sem migração de dados**.
