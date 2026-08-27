## Context

A Tree View já possui uma coluna `Progresso` e o componente `Row` sabe renderizar uma barra quando recebe `progress`, mas o endpoint `/items/tree` não preenche esse campo. O Board calcula progresso a partir de items `TASK`/`BUG` folha concluídos. A Tree View precisa receber o mesmo indicador para itens agrupadores e folhas, inclusive no modo `SIMPLE`.

## Goals / Non-Goals

**Goals:**

- Calcular e exibir progresso percentual em todas as linhas relevantes da árvore.
- Usar uma regra única: folhas `TASK`/`BUG` valem 0% ou 100% conforme status `DONE`; agrupadores usam a média de suas folhas descendentes.
- Mostrar barra visual e percentual numérico entre 0% e 100%.
- Preservar filtros, hierarquia, modo simples e itens arquivados fora do cálculo.

**Non-Goals:**

- Alterar status, pontos ou o cálculo de progresso do Board.
- Transformar módulos ou a STORY fixa em items móveis.
- Adicionar edição ou persistência de progresso manual.

## Decisions

- **Cálculo no backend da árvore:** enriquecer cada nó ao montar o payload de `GET /items/tree`, evitando duplicar a regra em cada renderização e mantendo a Tree View consistente entre clientes. Uma derivação apenas no componente foi descartada porque o endpoint já entrega a árvore recursiva.
- **Unidade de progresso:** considerar somente `TASK` e `BUG` folha do subárvore. Um leaf concluído (`DONE`) vale 100%; qualquer outro status vale 0%. Agrupadores sem folhas recebem 0%.
- **Progresso bottom-up:** construir filhos primeiro, calcular a lista de folhas descendentes e atribuir `progress` ao nó. A mesma função será usada para raízes de módulos, EPICs, STORYs e para a STORY fixa do modo simples.
- **Filtros antes do cálculo:** aplicar os filtros de módulo, responsável e sprint ao conjunto de itens antes da agregação, de modo que o percentual represente o resultado visível na árvore. Itens arquivados já são excluídos na consulta base.
- **Contrato numérico limitado:** retornar `progress` como inteiro de 0 a 100. O frontend limita a largura visual ao intervalo para proteger-se contra payloads inconsistentes.
- **Atualização após mutações:** manter a atualização existente da Tree View após recarregamento/alternância; eventos realtime não criarão uma segunda regra de cálculo nesta etapa.

## Risks / Trade-offs

- [Árvore grande aumenta o custo de cálculo] -> calcular em memória sobre o conjunto já carregado, em uma passagem recursiva, sem queries por nó.
- [Filtros podem alterar o percentual percebido] -> filtrar antes da agregação e documentar que o progresso reflete os itens visíveis.
- [Nós sem folhas exibem 0%] -> usar estado explícito e não ocultar a barra; 0% diferencia ausência de trabalho concluído.
- [Regra da Tree View divergir do Board] -> compartilhar a definição de folha/status nos testes e cobrir os mesmos casos do Board.

## Migration Plan

1. Adicionar cálculo bottom-up e `progress` ao contrato de árvore.
2. Ajustar o tipo/linha da Tree View para renderizar percentual limitado.
3. Adicionar testes de folhas, agrupadores, filtros e modo simples.
4. Validar typecheck, testes, lint e build; nenhuma migração de banco é necessária.

## Open Questions

- Nenhuma para esta etapa; progresso ponderado por pontos pode ser avaliado futuramente.
