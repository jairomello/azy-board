---
title: Consultar o Dashboard do Projeto
type: guide
order: 10
---

# Consultar o Dashboard do Projeto

O Dashboard reúne uma fotografia gerencial do projeto sem substituir o Board. O recorte visual atual apresenta oito blocos: Progresso e Escopo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Carga da Equipe e Horas Registradas. Sprint e Versões não fazem parte da tela atual.

Cada bloco combina uma métrica principal, um gráfico e um detalhe textual equivalente. O gráfico é uma forma de leitura rápida, não uma nova fonte de dados: a lista, tabela ou descrição acessível do card permanece a referência para os valores exatos e para abrir o Board com contexto.

## Visualizações dos cards

| Card | Visualização | O que representa |
|---|---|---|
| Progresso e Escopo | Donut de concluídos/restantes e barras de quantidade/pontos | Folhas concluídas e escopo atual; pontos aparecem somente quando há estimativa. |
| WIP | Barras por status e lista compacta | Itens ativos no estado atual, incluindo a parcela bloqueada. |
| Bloqueados | Distribuição por squad ou responsável e lista de motivos | Itens explicitamente impedidos; a distribuição não é ranking. |
| Atrasados | Barras por faixa de dias e itens mais antigos | Itens cuja data planejada é anterior à data de consulta. |
| Burnup | Área temporal de escopo e concluídos | Evolução diária dentro do histórico disponível, com linha de cobertura quando aplicável. |
| Aging WIP | Histograma de faixas de idade e lista ordenada | Idade do episódio ativo atual; itens iniciados antes da cobertura têm idade mínima conhecida. |
| Carga da Equipe | Barras por pessoa com alternância entre itens e pontos | Quantidade de itens WIP não bloqueados por pessoa, ou pontos estimados quando houver cobertura. Não é ranking. |
| Horas Registradas | Big-number e donut por autor do log | Soma de logs manuais com duração positiva; hover/foco mostra autor e total de horas. |

## Cores e estados

As cores têm semântica consistente: verde indica concluído ou estado saudável, azul/índigo indica série principal e progresso, âmbar indica atenção, atraso ou cobertura parcial, vermelho indica bloqueio ou impedimento e cinza indica restante, ausência ou dado não aplicável. A cor nunca é a única forma de comunicar o estado: o card também mostra texto, rótulo, padrão ou lista equivalente. No tema escuro, os mesmos significados usam tons com contraste ajustado.

Todos os cards podem exibir `loading`, vazio, erro recuperável, **cobertura parcial** ou filtro inaplicável. Loading usa skeleton sem valores fictícios; vazio explica por que não há série; erro oferece nova tentativa; filtro inaplicável é informado sem alterar silenciosamente o resultado.

## Filtros

Os filtros independentes são período, módulo, sprint, versão, squad, responsável e tipo. Período se aplica ao Burnup e às Horas Registradas. Os demais blocos usam o estado atual, salvo o Burnup, que usa snapshots históricos. Filtros não aplicáveis são identificados pela tela e não alteram silenciosamente o resultado.

## Cobertura histórica

O Dashboard informa a data em que a cobertura analítica começou. Dados anteriores não são reconstruídos por `updatedAt` ou por textos de atividade. Burnup e Aging podem aparecer como **cobertura parcial**; itens ativos no início da cobertura exibem apenas a idade mínima conhecida.

Uma série parcial deve ser lida somente dentro do intervalo indicado na tela. Ausência de pontos antes do início da cobertura não significa ausência de trabalho, e uma linha de escopo não prova que todo o histórico do projeto foi capturado.

## Horas Registradas

O bloco soma somente logs manuais com `durationMin > 0`, usando `item_logs.createdAt` como data do registro. Isso representa horas informadas no sistema, não uma data contábil ou necessariamente o momento em que o trabalho ocorreu. O agrupamento pessoal é pelo autor do log e seu squad atual.

Horas registradas não equivalem automaticamente a esforço total, capacidade, custo, produtividade ou tempo de execução de um item. Logs sem duração positiva ficam fora da soma; a tela informa a cobertura dos logs e não deve ser usada para comparar pessoas. O donut agrupa pelo autor do log, não pelo responsável do item.

## Interpretação segura

Carga da equipe mostra somente a quantidade de itens WIP não bloqueados por pessoa. O modo de pontos usa apenas itens estimados e informa a cobertura; pontos nulos não são convertidos em pontos zero silenciosamente. Não há ranking individual, comparação de produtividade, limite WIP configurável, previsão probabilística ou recomendação de IA.

Os gráficos também não representam finanças, capacidade configurável, P85, CFD, throughput, lead time ou cycle time. Percentuais e barras são relativos ao conjunto filtrado e ao período aplicável; não devem ser interpretados como previsão de prazo ou causalidade. Tooltips, foco por teclado e tabelas equivalentes apresentam categoria, valor e unidade sem depender de hover ou cor.
