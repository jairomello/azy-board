# Tasks

Board ref: B12 e T78 (projeto Azyboard)

## 1. Data civil no eixo (B12)

- [x] 1.1 Ajustar o formatador do eixo para montar datas sem hora em horário local, preservando o formato do locale e mantendo instantes com hora no fuso do usuário; verificar com teste unitário cobrindo data pura em fuso negativo, data com hora e valor não-data (B12)

## 2. Burnup sem evolução (T78)

- [x] 2.1 Detectar período sem conclusão e sem variação de escopo e exibir mensagem explícita no lugar do gráfico, mantendo as notas de cobertura e a projeção; verificar com teste de componente nos dois casos (com e sem evolução) (T78)
- [x] 2.2 Condicionar o recorte de pontos do burnup à cobertura de estimativa, com a orientação de estimar no lugar do gráfico vazio; verificar com teste de componente (T78)
- [x] 2.3 Adicionar as chaves de tradução nos três idiomas e verificar com `bun run check:i18n` (T78)

## 3. Verificação integrada

- [x] 3.1 Rodar `bun run check` e `bun run test:smoke` verdes na árvore final; verificar com os dois comandos
- [x] 3.2 Confirmar em navegador, com sessão autenticada, que o eixo do burnup mostra o dia correto e que o quadro explica a ausência de evolução; verificar por leitura do DOM e visualmente

## Workflow follow-up

- Implementar a change com `/opsx-apply`.
- Encerrar os cards B12 e T78 no Azy Board com `complete_task` e confirmar `status: DONE` no board real.
