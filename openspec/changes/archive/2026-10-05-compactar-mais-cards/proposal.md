## Why

O modo **Compacta** entregue no T33 compactou bem o cabeçalho, mas teve pouco efeito nos cards: medindo um card real (bug com checklist), o total fica em **~188 px**, com o **título de 2 linhas (~39 px)**, o **breadcrumb (~16 px)** e **padding/gaps (~37 px)** dominando a altura. Como o objetivo é privilegiar o espaço dos cards no Kanban, é preciso compactar mais no estado Compacta.

**Board ref:** `8a640c8f-ce9e-416b-aad6-8708d970321f` (T34 - Layout - compactar mais os cards na densidade Compacta). Referência da entrega anterior: T33 (`4741c2c8-e3bb-4a10-8327-aab11f9baf1d`).

## What Changes

- **Apenas o estado Compacta muda**; o estado **Confortável permanece inalterado**.
- No estado Compacta, o card passa a:
  - **limitar o título a 1 linha**, com o texto completo acessível por tooltip/title;
  - **ocultar o breadcrumb** (informação contextual);
  - reduzir o **gap entre regiões** (~4 px) e o **padding vertical** (~0,3 rem).
- **Nada é removido além disso**: topo (alça, ícone, código), etiquetas, progresso de checklist e rodapé continuam visíveis; ações, edição inline, arraste e acessibilidade preservados.
- **Sem novo controle**: continua sendo o mesmo botão de densidade (Confortável ↔ Compacta).
- **Meta**: reduzir o card de exemplo de ~188 px para **~142 px** (−25%).

**Fora de escopo:** alterar o layout Confortável, mudar o cabeçalho do Board (já entregue no T33), alterar densidade da árvore/modais.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-compact-density`: o requisito de compactação dos cards passa a permitir título em 1 linha (com tooltip) e ocultação do breadcrumb no estado Compacta, mantendo as demais regiões e os controles.

## Impact

- **Web**: `apps/web/src/components/KanbanCard.tsx` (ganchos de classe `kanban-card-title`/`kanban-card-breadcrumb` e `title` do título) e `apps/web/src/styles/globals.css` (regras escopadas em `.density-compact`).
- **Testes**: contrato estrutural do efeito do compacto (título 1 linha e breadcrumb oculto) e verificação `bun run check`, `test:smoke`, `check:bundle`.
- **Sem impacto de backend/API** e **sem migração de dados**.
