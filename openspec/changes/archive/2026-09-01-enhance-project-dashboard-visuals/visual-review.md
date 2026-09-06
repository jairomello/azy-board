# Revisão visual do Dashboard

Data da revisão: 2026-08-30

## Resultado

- A página autenticada abriu o projeto `Azy Board` sem erro.
- Os dez cards foram renderizados.
- Foram encontrados 24 elementos SVG de gráficos na página.
- Não houve card em estado vazio com o seed de demonstração.
- Em viewport de 780 px, a largura do documento ficou menor que a viewport; não houve overflow horizontal.
- Burnup exibiu 15 pontos diários, Aging exibiu 8 itens e Horas exibiu dados por dia.
- Filtros por tipo, squad, módulo e período retornaram recortes coerentes.

## Objetivos atendidos

- Progresso e Escopo: donut e barras de itens/pontos.
- WIP: distribuição por status e lista de itens.
- Bloqueados: distribuição e motivos nos dados de origem.
- Atrasados: distribuição por faixa e lista de itens.
- Burnup: área temporal, cobertura parcial, alternância de itens/pontos e tabela.
- Aging WIP: histograma, mínimo/mediana/máximo e itens antigos.
- Sprint: comparação de compromisso, conclusão, escopo atual e histórico.
- Versões: barras de quantidade e pontos.
- Carga da Equipe: WIP e bloqueados como subconjunto, sem ranking.
- Horas Registradas: total, barras por dia e alternância por autor/squad.

## Acabamentos identificados

- Alguns nomes de séries e controles ainda estão em inglês no locale PT-BR e devem ser passados pelo i18n.
- O card de Bloqueados pode mostrar o motivo diretamente no resumo visual, além da lista.
- O card de Atrasados pode mostrar a idade em dias no detalhe, além das faixas.
- A revisão foi automatizada via Chromium headless; a inspeção visual humana final continua recomendada.
