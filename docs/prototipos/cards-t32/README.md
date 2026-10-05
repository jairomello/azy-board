# T32 — propostas de layout para cards

Os três arquivos SVG simulam a coluna real de 292 px e usam exemplos de tarefa e bug do board. São estudos visuais para escolha de direção; a interface ainda não foi alterada.

| Proposta | Ênfase | Principal troca |
| --- | --- | --- |
| [01 — Essencial](01-essencial.svg) | Hierarquia equilibrada e metadados previsíveis | Altura intermediária |
| [02 — Foco no título](02-foco-no-titulo.svg) | Leitura da tarefa; código junto ao título | Menos cards visíveis |
| [03 — Compacto](03-compacto.svg) | Comparação rápida em colunas longas | Menos espaço para tags longas |

## Decisões comuns

- O código curto do card substitui o UUID abreviado como referência visível.
- O tipo aparece uma vez, sempre por texto e cor.
- O título recebe a maior ênfase tipográfica.
- Prioridade e responsável ficam em posição previsível.
- A alça de arraste continua separada do conteúdo clicável.
- O ícone mostra uma figura e uma cor configuráveis pelo usuário, independentes do tipo do card.
- O breadcrumb permanece no topo. Em boards hierárquicos pode mostrar Épico › História, com truncamento quando necessário.
- Tags aparecem em uma faixa própria. Pontos e quantidade de subtarefas ficam na faixa de metadados, quando presentes.
- Na proposta 02, o código fica ao lado da primeira linha do título. O antigo ponto colorido do canto superior direito foi removido porque repetia a informação de tipo.
- O segundo card de cada SVG mostra o estado de hover: copiar, arquivar e excluir ocupam uma faixa reservada de 84 px no canto superior direito. O tipo aparece na linha das tags nas propostas 01 e 02, deixando o breadcrumb livre e sem sobreposição.

## Base consultada

- [Componente atual](../../../apps/web/src/components/KanbanCard.tsx) e [colunas do board](../../../apps/web/src/features/board/components/BoardColumns.tsx).
- [Nielsen Norman Group — Cards: UI-Component Definition](https://www.nngroup.com/articles/cards-component/): elementos em posições consistentes facilitam a comparação e a leitura de conjuntos de cards.
- [Atlassian Design — Spacing](https://atlassian.design/foundations/spacing): espaçamento deve comunicar agrupamento e hierarquia.
- [Atlassian Design — Drag and drop guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines): a área de arraste e o estado visual de arraste precisam ser claros.

Para regenerar os estudos: `python3 docs/prototipos/cards-t32/gerar_propostas.py`.
