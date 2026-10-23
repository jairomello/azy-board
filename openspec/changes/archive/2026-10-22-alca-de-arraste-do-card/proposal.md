# Proposal

## Why

Mover o card entre colunas é a operação central do Kanban, mas a alça que a inicia é quase imperceptível: um rail de 17 px com seis pontos a ~25 % de opacidade, encostado na borda esquerda. Parte da equipe relata que não descobre como mover um card. O símbolo de pontos não comunica "mover" e o único destaque de hover do rail (25 % → 60 % de opacidade) é sutil demais para quem ainda não sabe que aquele elemento é uma alça. Testado no board em execução, o estado de repouso da seta também se mostrou dispensável: sem ponteiro no card, ele só acrescenta ruído — a seta passa a aparecer no primeiro contato com o card.

## What Changes

- A alça passa de 17 px para **aproximadamente 30 px de largura**, mantendo a altura total do card e a posição na lateral esquerda, o que amplia o alvo do ponteiro sem invadir as demais regiões do card (topo, breadcrumb, título, etiquetas, progresso e rodapé).
- O símbolo de seis pontos é substituído por uma **seta de quatro pontas** (ícone `Move`), que comunica o arraste em qualquer direção.
- A seta passa a existir **só enquanto o ponteiro está no card**: fica oculta em repouso, aparece quando o ponteiro entra em qualquer ponto do card e recebe **destaque forte** — cor de destaque e fundo sutil — quando o ponteiro está sobre a própria alça. O foco por teclado revela a seta com o mesmo destaque. Em dispositivo sem hover (toque), a seta permanece visível, porque ali o estado "ponteiro sobre o card" não acontece.
- O contrato do arraste não muda: a alça continua sendo o único elemento com `listeners` e `setActivatorNodeRef`, o `title` "Arrastar card" é preservado (as jornadas de e2e localizam a alça por ele), o clique no card continua abrindo o modal, as ações do topo não iniciam arraste e cards não arrastáveis seguem com cursor de indisponível.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `kanban-card-layout`: dois requisitos novos no card do Kanban — a alça de arraste com largura ampliada e símbolo de quatro pontas, e a visibilidade da seta (oculta em repouso, visível com o ponteiro no card, com destaque forte na alça e no foco por teclado), preservando as interações existentes.

## Impact

- Código: `apps/web/src/components/KanbanCard.tsx` (rail da alça e símbolo) e `apps/web/src/styles/globals.css` (largura da alça no `@layer components` e regras de destaque por estado e tema).
- Sem mudança de API, de banco, de dependência ou de payload: é o pacote visual do card do board.
- Regressão visual: nenhuma baseline muda. O snapshot `board-simple` de `e2e/visual.ts` é capturado antes de criar cards, então não cobre a alça; os baselines também divergem por renderização do ambiente. A alça fica vigiada por teste de componente, por script de board com medições e pelas jornadas de e2e.
- E2E: `e2e/journeys.ts` encontra a alça por `[title="Arrastar card"] svg` e inicia o arraste no centro desse SVG — o `title` e o SVG interno sobrevivem à troca do símbolo.
- i18n: reutiliza a chave `dragCard`, já traduzida em pt-BR/en/es; nenhuma chave nova prevista.
- Acessibilidade: a alça já recebe `role="button"` e `tabIndex` do `useSortable`; o requisito exige que o destaque forte também apareça no foco por teclado, com nome acessível traduzido.
- `Board ref: 8afd60a1-2ab3-40de-8719-8e860de5287a` (card **T85** no Azy Board).
