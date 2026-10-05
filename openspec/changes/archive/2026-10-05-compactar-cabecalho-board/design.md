## Context

O Board é renderizado por `BoardScreen.tsx` dentro do `AppShell`. O topo da área de trabalho empilha três faixas:

1. **Barra de controles** (`BoardCommandBar.tsx`), com altura fixa de `h-[54px]` num wrapper do `AppShell` com `mt-3`.
2. **Linha de filtros ativos** (`ActiveFilterChips.tsx`), primeiro filho do conteúdo.
3. **Painel "Progresso Geral"** (`BoardContextHeader`, em `BoardContext.tsx`), um `<section>` com `px-4 py-3`.

Já existe o controle de **densidade** (`density: 'comfortable' | 'compact'`) em `BoardCommandBar`, persistido em `board-density` e aplicado ao contêiner das colunas pela classe `density-compact`. **Regressão atual:** a regra `.density-compact .kanban-card-content { … }` (`globals.css:216`) mira a classe `kanban-card-content`, que o `KanbanCard` reescrito no T32 deixou de usar — logo o botão não altera a tela. A antiga regra também usava `gap`, mas o conteúdo novo usa `space-y-2` (margens), então apenas readicionar a classe não bastaria.

Restrições: sem dependências novas; i18n PT-BR/EN/ES; `bun run check`, `test:smoke`, `check:bundle` (chunk do Board).

**Board ref:** `4741c2c8-e3bb-4a10-8327-aab11f9baf1d` (T33).

## Goals / Non-Goals

**Goals:**

- Fazer o **controle de densidade existente** produzir, no estado `Compacta`, o **cabeçalho super compacto** e a **compactação dos cards** no mesmo acionamento.
- **Corrigir a regressão** para que `Compacta` volte a ter efeito visível nos cards, sem remover informações do card.
- Manter `Confortável` como **padrão** (layout atual preservado) e todas as funções acessíveis.
- Preservar acessibilidade, temas claro/escuro e comportamento responsivo.

**Non-Goals:**

- Criar um segundo toggle ou uma nova preferência.
- Mudar a persistência da densidade (permanece global em `board-density`).
- Alterar o cabeçalho global do app, a densidade em telas de modal/árvore ou redesenhar colunas.
- Backend, API ou migração de dados.

## Decisions

### D1 — Um único controle: densidade dirige cabeçalho e cards

`density` passa a significar: `comfortable` = layout atual (padrão); `compact` = cabeçalho super compacto **e** cards densos. Nenhum novo toggle/preferência é criado; a persistência continua em `board-density`.

- *Por quê:* o usuário pediu explicitamente para reaproveitar o botão existente; um único controle evita redundância e mantém a semântica "densidade" da tela.
- *Alternativa considerada:* novo toggle separado (proposta inicial). Descartada a pedido do usuário.

### D2 — Corrigir a compactação dos cards (regressão do T32)

Reintroduzir um **gancho de densidade** na estrutura atual do `KanbanCard` (classe `kanban-card-content` no contêiner de conteúdo, como antes) e **atualizar as regras CSS** para a estrutura nova: reduzir `padding` vertical e o espaçamento entre regiões via `.density-compact .kanban-card-content > * + * { margin-top: … }` (o conteúdo usa `space-y-2`/margens).

- *Por quê:* a regra antiga não casa mais; só readicionar a classe não compactaria o espaçamento entre regiões.
- *Alternativa considerada:* passar uma prop `compact` do `BoardLanes` ao `KanbanCard` e alternar classes Tailwind. Mais explícito em React, porém espalha a densidade por mais arquivos; a abordagem por classe/CSS é centralizada e já existe como convenção.
- *Mitigação de regressão futura:* teste estrutural garantindo que o CSS de densidade mira uma classe presente no `KanbanCard` atual.

### D3 — Layout do cabeçalho no estado Compacta

- **Barra de controles**: wrapper `mt-3`→`mt-2`; barra `h-[54px]`→~`h-10`, mantendo controles com quebra de linha sem corte.
- **Progresso**: o painel `BoardContextHeader` é substituído por um **indicador fino** (ícone + percentual + contagem) embutido na barra; mesmos números.
- **Filtros ativos**: a linha vira um **resumo** ("N filtros") na barra que abre a lista completa em popover, com remoção individual.
- **Conteúdo**: `mt-3`→`mt-2` e `gap-3`→`gap-2`.

### D4 — Resumo de filtros acessível e reutilizando `ActiveFilterChips`

O resumo é um botão com `aria-label` que descreve a contagem; o popover reutiliza o componente de chips (mesmos rótulos e botões de remoção focáveis). No estado `Confortável`, a linha permanece como hoje.

- *Por quê:* preserva o requisito de remoção individual e evita duplicar lógica de chips.

### D5 — Independência do restante

A densidade compacta afeta a **área do Board** (topo + cards do Kanban). A árvore e as modais permanecem inalteradas; a densidade não altera filtros nem visualização.

### D6 — Acessibilidade, i18n e temas

O toggle mantém `aria-pressed`, rótulo `density`/`comfortable`/`compact` existentes; o resumo de filtros adiciona chaves traduzidas nos três locales. Paridade de contraste nos temas claro/escuro; sem rolagem horizontal.

### D7 — Verificação

Teste estrutural `[CONTRATO-ESTRUTURAL]` de que o CSS de `.density-compact` mira o gancho presente no `KanbanCard` e de que o estado compacto altera o topo (barra/progresso/resumo); `bun run check`, `test:smoke`, `check:bundle`; validação visual ligando/desligando a densidade.

## Risks / Trade-offs

- **[Regressão silenciosa de densidade em refatorações futuras do card] →** gancho de classe no card + teste estrutural que amarra CSS e componente.
- **[Compactar demais prejudicar a leitura] →** reduzir apenas espaçamento/padding, sem esconder regiões nem truncar além do que já existe.
- **[Filtros menos visíveis no modo denso] →** resumo mostra a contagem e abre a lista completa; remoção por teclado preservada.
- **[Progresso "sumir"] →** manter percentual e contagem no indicador fino.
- **[Regressão de layout em telas pequenas] →** permitir quebra de linha dos controles e validar larguras reduzidas.
- **[Bundle do BoardPage] →** mudanças pequenas e sem novas dependências; medir com `check:bundle`.

## Migration Plan

Aditivo e reversível: sem migração de dados; `Confortável` continua o default e a densidade persistida segue em `board-density`. Rollback: reverter as regras/classes restaura o comportamento anterior.

## Open Questions

- O estado Compacta deve também compactar a árvore? Proposta: não nesta change (foco em topo + cards do Kanban).
- Migrar a densidade de global para por projeto? Fora de escopo; o `board-view-state-per-project` já prevê densidade por projeto, mas isso é um ajuste separado.
