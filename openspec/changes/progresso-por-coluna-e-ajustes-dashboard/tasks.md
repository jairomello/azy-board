# Tasks

Board ref: T66–T73 e B8–B11 (cards do projeto Azyboard)

## 1. Peso de avanço por coluna

- [x] 1.1 Adicionar `progressWeight` (inteiro 0–100, anulável) ao modelo de coluna, com migration aditiva e sem backfill; verificar com `bun run test:migrations` e teste de integridade do schema (T66)
- [x] 1.2 Implementar a derivação do peso em um único módulo compartilhado — `NOT_STARTED` 0, `DONE` 100, `BLOCKED` peso próprio, `IN_PROGRESS` distribuído na faixa (0, 100) pela ordem das colunas do status — e expor o peso efetivo no contrato de colunas da API; verificar com teste unitário cobrindo duas e três colunas `IN_PROGRESS`, coluna única e `NOT_STARTED`/`DONE` (T66)
- [x] 1.3 Validar `progressWeight` na escrita (faixa 0–100, inteiro) e garantir precedência do valor explícito sobre o derivado; verificar com teste de API (T66)
- [x] 1.4 Adicionar o editor de peso na tela de colunas do projeto, ao lado do status base, mostrando o valor derivado como sugestão e com ação de restaurar; verificar com teste de componente e confirmando que sem permissão de administração o campo não é editável (T67)
- [x] 1.5 Verificar que alterar o peso reflete nos indicadores sem recarregar a aplicação, com teste de componente cobrindo a atualização otimista (T67)

## 2. Cálculo do avanço no board e na árvore

- [x] 2.1 Implementar a fórmula do avanço (faixa da coluna delimitada pelo peso anterior; checklist afina dentro da faixa; sem checklist usa o peso da coluna) em módulo único do web; verificar com teste unitário cobrindo card sem checklist, checklist parcial, checklist vazio e garantia de monotonicidade (T68)
- [x] 2.2 Aplicar o avanço nas lanes de história do Kanban e no cabeçalho de sprint, mantendo o número de conclusão visível e rotulado; verificar com teste de componente (T68)
- [x] 2.3 Aplicar o avanço na Tree View (folhas e média dos agrupadores, com agrupador sem folhas em 0%) preservando filtros, arquivamento e modo `SIMPLE`; verificar com `bun test apps/web/src/pages/TreeViewPage*` e teste do cálculo acumulado (T68)
- [x] 2.4 Atualizar a spec `tree-progress` no comportamento verificado: cobrir o cenário de bug em progresso exibindo o avanço da coluna em vez de 0%; verificar com o teste do cenário (T68)

## 3. Dashboard: avanço e apresentação

- [x] 3.1 Expor `sequenceCode` (aditivo) no detalhe de itens de `/snapshot` e `/aging`, com nulo para item sem código; verificar com teste de contrato da resposta (B8)
- [x] 3.2 Rotular os rankings de aging e bloqueados com código ou título do card, com título completo em tooltip, sem usar o identificador técnico; verificar com teste unitário do adaptador e teste de componente (B8)
- [x] 3.3 Truncar nomes longos na Carga da Equipe com reticências e tooltip, alargando a calha do eixo, e cobrir o caso de nome muito longo em teste de componente (B10)
- [x] 3.4 Apresentar o avanço dentro do quadro de progresso e escopo, rotulado como avanço no fluxo e distinto de concluídos, respeitando os filtros aplicáveis; verificar com teste de componente e do adaptador (T69)
- [x] 3.5 Aplicar estado vazio compacto nos quadros sem dados, legenda única para os dois recortes do WIP e unidade não repetida na métrica principal; verificar com teste de componente dos estados vazios (T72)

## 4. Dashboard: idioma, formatos e ausência de estimativas

- [x] 4.1 Deixar de renderizar `hours.semantics` e usar a chave de tradução do quadro de horas; verificar com teste de componente que o texto técnico não aparece em pt-BR, en e es (B9)
- [x] 4.2 Internacionalizar os rótulos dos adapters do dashboard nos três idiomas; verificar com `bun run check:i18n` (B11)
- [x] 4.3 Estender `check:i18n` para os módulos de adaptação `.ts` que produzem rótulos exibidos e corrigir o que ele acusar; verificar com `bun run check:i18n` e teste do próprio gate (B11)
- [x] 4.4 Omitir as visões de pontos quando a cobertura de estimativa for zero e apresentar orientação acionável de estimar, restaurando as visões quando houver item estimado; verificar com teste de componente nos dois casos (T70)
- [x] 4.5 Formatar datas e decimais dos eixos pelo locale ativo e explicar a origem da série em quadros com cobertura parcial, incluindo a sinalização de idade mínima conhecida no aging; verificar com teste unitário dos helpers de formatação e teste de componente da mensagem de cobertura (T71)

## 5. Dado de produção do NT-my-update

- [ ] 5.1 Definir explicitamente o peso das colunas do projeto NT-my-update (sugestão: "Fazendo" = 50, "A Testar" = 90), sem mover cards e sem preencher pontos; verificar lendo as colunas do projeto pela API e confirmando os valores gravados (T73)
- [ ] 5.2 Confirmar no board e no dashboard do NT-my-update que o avanço deixou de ser 0% com os cards em "A Testar" e que a conclusão continua em 0 de 33; verificar com leitura autenticada das duas telas (T73)

## 6. Verificação integrada

- [x] 6.1 Rodar `bun run check` e `bun run test:smoke` verdes na árvore final; verificar com os dois comandos
- [x] 6.2 Confirmar em navegador, com sessão autenticada, que o board mostra avanço e conclusão separados, que a árvore reflete o avanço e que o dashboard exibe o avanço, os rótulos legíveis e nenhum texto técnico; verificar visualmente e por leitura do DOM
- [x] 6.3 Confirmar que escopo, burnup e cobertura de estimativa continuam baseados em conclusão, sem regressão de valor; verificar comparando as respostas de `/snapshot` e `/burnup` antes e depois

## Workflow follow-up

- Implementar a change com `/opsx-apply`.
- Publicar em produção e aplicar o ajuste de dados do NT-my-update (task 5) após validar o release.
- Encerrar os cards T66–T73 e B8–B11 no Azy Board com `complete_task` e confirmar `status: DONE` no board real.
- Arquivar a change após a revisão do projeto.
