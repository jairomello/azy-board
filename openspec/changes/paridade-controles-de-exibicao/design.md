# Design

## Contexto

`BoardFilters` era compartilhado entre o popover de filtros e o painel de opções, mas
renderizava todos os controles de exibição sem saber em qual visualização estava. O painel
`Opções` da command bar só era montado fora da árvore. A árvore já aplicava
`hideEmptyEpics`, mas não `hideEmptyStories`, e nenhum dos dois tinha controle na grade.

## Decisão — a visão decide a aplicabilidade

**Escolhido:** `BoardFilters` recebe `view: 'kanban' | 'unified' | 'tree'` (padrão
`kanban`) e calcula quais controles exibir.

| Controle | Board | Unificado | Árvore |
| --- | :---: | :---: | :---: |
| Módulos (hierarquia/abas) | sim | não | não |
| Mostrar subtasks | sim | sim | não |
| Histórias como cards | sim | sim | não |
| Expandir/recolher | sim | não | não (a grade tem os próprios) |
| Ocultar ramos vazios (módulos/épicos) | sim | não | sim |
| Ocultar histórias vazias | sim | não | sim |
| Recalcular datas / Exportar | sim | sim | sim |
| Caminho crítico | sim | sim | não |

**Por quê:** a regra do produto é que todo controle disponível no Board esteja disponível
nas demais visões quando tiver efeito. Esconder um controle inerte é melhor que exibi-lo
sem resultado.

**Alternativas descartadas:**
- *Mostrar todos os controles em todas as visões:* no Unificado, "ocultar épicos vazios"
  não tem alvo; na árvore, "histórias como cards" não existe. Seria ruído e promessa falsa.
- *Ocultar colunas vazias no Unificado:* coluna vazia é destino de arraste; escondê-la
  impediria mover um card para lá.

## Árvore — filtros de vazio

`filterHideEmptyStories` remove `STORY` sem filhos após a poda recursiva.
`filterHideEmptyEpics` passa a remover também módulos sem descendentes visíveis. A ordem é
histórias e depois ramos: um épico que só tinha histórias vazias também desaparece quando
os dois filtros estão ligados.

## Árvore — Opções e cronograma

`Opções` passa a ser renderizado em todas as visualizações. O toggle de caminho crítico é
omitido na árvore porque o destaque (`criticalIds`) só é desenhado em `BoardColumns` e
`UnifiedBoard`; "Recalcular datas" e "Exportar dados" seguem disponíveis.

## Riscos e limites

- Em projeto `SIMPLE`, os filtros de épico/história não aparecem porque não há hierarquia.
- `hideEmptyStories` continua não afetando o Board com histórias como cards (onde não há
  lane) e não altera a contagem de filtros ativos nesse modo.
