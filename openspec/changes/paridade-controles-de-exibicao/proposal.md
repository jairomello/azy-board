# Proposal

## Why

Os controles de exibição do board existem apenas na visualização **Board**. Quem troca para
**Unificado** ou **Árvore** perde acesso a eles, mesmo quando o efeito é aplicável:

- a **Árvore** já respeita `hideEmptyEpics` para épicos, mas o toggle não aparece em lugar
  nenhum na própria árvore, módulos vazios continuam na grade e `hideEmptyStories` nem é
  aplicado;
- o **Unificado** esconde os toggles de subtasks e de histórias como cards, embora os dois
  mudem a população de cards exibida;
- o painel **Opções** inteiro desaparece na árvore, levando junto cronograma e exportação.

O resultado é visões poluídas (épicos/histórias vazios na árvore) e controles que só
existem em uma das três formas de ver o mesmo recorte.

## What Changes

- Manter o painel **Opções** disponível nas três visualizações, exibindo somente os
  controles com efeito na visão atual.
- **Board**: mantém todos os controles atuais (módulos, subtasks, histórias como cards,
  expandir/recolher, ocultar épicos/histórias vazios).
- **Unificado**: passa a oferecer **Mostrar subtasks** e **Histórias como cards**. Os
  controles de lane (abas, expandir/recolher, ocultar épicos/histórias) não se aplicam.
- **Árvore**: passa a oferecer **Ocultar ramos vazios** (módulos e épicos sem descendentes)
  e **Ocultar histórias vazias**. O segundo passa a ser aplicado de fato na grade,
  removendo histórias sem filhos visíveis.
- Na árvore, **Recalcular datas** e **Exportar dados** ficam acessíveis pelo painel; o
  toggle de caminho crítico continua exclusivo do Kanban, onde o destaque é desenhado.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-filters`: os controles de exibição passam a ter paridade entre as visualizações,
  com matriz de aplicabilidade.
- `tree-view`: a grade passa a ocultar histórias vazias, além dos épicos vazios já
  suportados.

## Impact

- Frontend: `BoardFilters` recebe a visão atual e decide o que exibir; `BoardCommandBar`
  expõe `Opções` também na árvore; `TreeViewPage` aplica `hideEmptyStories`.
- Sem mudança de API, schema ou MCP: os filtros continuam no estado do board.
- Nenhum controle novo de preferência: `hideEmptyStories` já existia e passa a valer
  também na árvore; `hideEmptyEpics` passa a ocultar módulos vazios junto com épicos.

## Assumptions

- "Vazio" na árvore significa ramo sem filhos visíveis após os demais filtros.
- Não existe **ocultar colunas vazias** no Unificado: coluna vazia é destino de arraste e
  escondê-la impediria mover cards para ela.
- O caminho crítico não é destacado na árvore; por isso o toggle não é oferecido nela.
