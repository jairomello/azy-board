---
title: Objetivos dos Quadros do Dashboard
type: reference
order: 11
---

# Objetivos dos Quadros do Dashboard

O Dashboard é uma leitura gerencial do mesmo trabalho existente no Board. Ele não cria uma segunda fonte de verdade: os itens folha vêm de `items`, as horas vêm de logs manuais e os gráficos históricos usam eventos analíticos observados. Sprint e Versões não integram o recorte visual atual.

## Progresso e Escopo

Mostra quanto do trabalho elegível foi concluído e quanto ainda existe. O donut responde **“qual é a proporção concluída?”**. As barras comparam quantidade de itens e pontos. A cobertura de estimativa informa se a leitura por pontos representa todo o escopo ou apenas parte dele.

## WIP

Mostra o trabalho atualmente em andamento ou bloqueado. A distribuição por status responde **“onde está concentrado o trabalho ativo?”**. Não é um limite de capacidade nem uma avaliação de produtividade.

## Bloqueados

Mostra o trabalho que não pode avançar por um impedimento explícito. A distribuição indica se os bloqueios estão atribuídos ou sem responsável, e a lista deve ser usada para abrir o item e entender o motivo.

## Atrasados

Mostra itens não concluídos cuja data planejada já passou. As faixas respondem **“o atraso é recente ou persistente?”**. Um item sem `dueDate` não aparece como atrasado.

## Burnup

Compara escopo total e trabalho concluído ao longo dos dias UTC. A linha de escopo sobe quando o trabalho é adicionado e a linha de concluídos sobe quando itens chegam a `DONE`. A distância entre as linhas ajuda a perceber se a entrega acompanha o crescimento do escopo. Cobertura parcial significa que não existe histórico confiável antes da data indicada.

## Aging WIP

Mostra há quanto tempo o episódio atual de cada item permanece em WIP. O histograma responde **“há trabalho ativo envelhecendo?”**. A mediana mostra o comportamento típico e o máximo destaca o item mais antigo. “Idade mínima conhecida” indica item que já estava ativo quando o histórico começou.

## Sprint

Compara o compromisso capturado na abertura do ciclo com o estado atual e o que foi concluído. Serve para responder **“o que foi assumido e quanto avançou?”**. O compromisso não concluído não é previsão nem julgamento da equipe; ciclos migrados aparecem como parciais.

## Versões

Mostra o progresso das entregas por release. As barras de itens e pontos respondem **“quais versões estão avançando e quais ainda estão sem entrega?”**. Versões vazias permanecem visíveis para revelar planejamento ainda não iniciado.

## Carga da Equipe

Mostra somente a quantidade de itens WIP não bloqueados por pessoa, incluindo itens sem responsável. O toggle alterna entre quantidade e pontos; pontos nulos ficam fora da soma e a cobertura é informada. O quadro responde **“onde está o trabalho ativo?”**, não **“quem é mais produtivo?”**. Não há ranking, score ou comparação de horas.

## Horas Registradas

Soma as durações positivas dos logs manuais no período. O big-number mostra o total geral e o donut agrupa o total por autor do log. O quadro responde **“quanto esforço foi informado no sistema?”**, não quanto tempo efetivo foi necessariamente trabalhado em cada data.

## Como ler os filtros

Filtros de estado atual alteram Progresso, WIP, Bloqueados, Atrasados, Aging e Carga conforme sua aplicabilidade. O período é usado no Burnup e em Horas Registradas. Sprint e Versões continuam disponíveis nos filtros quando aplicáveis a outros quadros, mas não têm card visual. Um filtro inaplicável é informado, não aplicado silenciosamente.

## Como ler as cores

- Roxo/azul: escopo, quantidade ou série principal.
- Verde: concluído ou estado saudável de entrega.
- Âmbar: atenção, cobertura parcial ou faixa de envelhecimento.
- Vermelho/coral: bloqueio ou atraso.
- Cinza: restante, ausência de dados ou referência neutra.

As cores sempre vêm acompanhadas de texto, legenda, valores ou tabela equivalente.
