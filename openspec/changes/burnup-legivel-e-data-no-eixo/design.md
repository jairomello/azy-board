# Design

## Context

O burnup é montado no cliente: `burnupData` transforma a série do endpoint (`date`, `total`, `done`, `points`, `donePoints`) em dados do gráfico, e `TimeArea` desenha duas áreas — escopo e concluído — com preenchimentos de baixa opacidade. O eixo X recebe `tickFormatter={shortDateTick}`, que formata a data pelo locale ativo (introduzido em T71).

A série do NT-my-update tem três pontos (13, 14 e 15/10) com `total = 33` e `done = 0` em todos. Não há estimativas (`estimationCoverage` 0), então `points` e `donePoints` também são zero.

O endpoint não devolve nada de errado: os valores são o estado real ao fim de cada dia UTC.

## Goals / Non-Goals

**Goals:**

- Rótulo de data do eixo representando o dia correto em qualquer fuso.
- O quadro dizer explicitamente quando não há evolução, em vez de parecer vazio.

**Non-Goals:**

- Mudar o cálculo do burnup no servidor (a série está correta).
- Corrigir `version.releaseDate` (mesmo defeito, anterior a este trabalho).
- Criar um décimo primeiro quadro ou mexer no burnup para "inventar" evolução.

## Decisions

### D1 — Data civil não passa pelo parser de instante

`shortDateTick` passa a detectar valores `YYYY-MM-DD` e montar a data em horário local (`new Date(ano, mês − 1, dia)`), formatando com o helper de locale. Instantes completos (com hora) continuam sendo formatados como instantes, porque aí o fuso do usuário é o comportamento correto.

**Alternativa descartada:** formatar por concatenação de partes (`dd/mm`). Perderia o formato do locale — em inglês a data é `MM/DD`.

### D2 — Estado "sem evolução" substitui o gráfico reto

O quadro considera que **não houve evolução** quando, no período exibido, nenhum ponto tem conclusão (`done`/`donePoints` zero em todos) e o escopo não varia (`total`/`points` constante). Nesse caso, em vez do gráfico, exibe uma mensagem compacta informando que não houve conclusão e que o escopo se manteve, mantendo as notas de cobertura (cobertura parcial, data de início da série e projeção).

O gráfico continua sendo exibido quando há qualquer conclusão ou variação de escopo — inclusive quando o escopo variou sem conclusão, que é informação legítima.

**Alternativa descartada:** manter o gráfico e apenas acrescentar a mensagem. A faixa reta continuaria sendo o elemento dominante e a leitura de "tela quebrada" permaneceria.

### D3 — Recorte de pontos segue a regra já vigente

O botão de pontos do burnup passa a depender da cobertura de estimativa, como já acontece nos quadros de progresso e de WIP. Não é comportamento novo: é o cumprimento de `Ausência de estimativas tratada explicitamente`, que vale para o dashboard inteiro.

### D4 — Orçamento do chunk `index` elevado de 90 000 para 92 000 bytes gzip

Medição da linha de base (build do commit anterior): `index` em **87,88 KB** contra o teto de **87,89 KB** — 10 bytes de folga. O chunk carrega os recursos de tradução dos três idiomas, então qualquer mensagem nova de produto estoura um teto já consumido.

A elevação é deliberada e versionada (o orçamento é um artefato do repositório), com o motivo registrado no próprio `bundle-budget.json`. O gate continua valendo: um crescimento real (biblioteca pesada entrando no index, por exemplo) segue reprovando.

**Alternativa descartada:** encolher a mensagem para caber. Medido: as três mensagens custam ~20 bytes gzip, e encurtá-las não fecha a diferença — o teto já estava no limite antes desta mudança.

## Riscos

- Projetos com escopo constante e nenhuma conclusão legítima (equipe parada) passam a ver mensagem em vez de gráfico — é o comportamento desejado, e a mensagem informa o escopo mantido.
- O estado depende da janela exibida: um período sem evolução dentro de uma janela maior com evolução continua mostrando gráfico, porque a avaliação é feita sobre a série recebida.

## Migration Plan

Sem migração de dados.
