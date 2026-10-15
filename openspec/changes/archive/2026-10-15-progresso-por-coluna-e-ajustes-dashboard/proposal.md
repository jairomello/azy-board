# Proposal

Board ref: T66–T73 e B8–B11 (cards do projeto Azyboard)
- T66 `6b71adf3-e88f-496d-85c1-211b1f575ccf` — peso por coluna (modelo, API e defaults)
- T67 `e1b12a8d-49c4-42fe-b4f3-27f419f9ca17` — editor de pesos nas configurações do projeto
- T68 `52de47c8-6c8f-4ebd-8f35-26782749a29a` — cálculo do avanço (board, sprint e árvore)
- T69 `d00486cf-c7b4-49df-b044-94f14b11a3ec` — avanço no dashboard, separado de concluído
- B8 `fc985956-477c-4913-af3a-91899941c7fe` — Aging WIP mostra ID truncado no eixo
- B9 `d2b194a4-70cd-45f9-a7db-53eee627a2f3` — Horas Registradas exibe descrição técnica em inglês
- B10 `0e74f7a2-e254-4f0c-9b88-28a53c83bf17` — Carga da Equipe com nomes longos quebram o eixo
- B11 `e781d0bc-8123-467f-b811-adade579759a` — rótulos fixos em inglês nos adapters e gate de i18n não cobre `.ts`
- T70 `d713410f-afff-4168-93b3-b52c7265197f` — ausência de estimativas tratada com dica
- T71 `16c69cd0-4670-4550-b179-a37d0e18a52c` — cobertura parcial e formatos por locale nos gráficos
- T72 `2a358735-34b7-40fd-866d-f3ed699ef2f0` — layout dos cartões vazios e legenda do WIP
- T73 `337dbd93-3e6a-434d-9ec9-41de514e1d57` — pesos das colunas do projeto NT-my-update (dado de produção)

## Why

O progresso do produto é **binário**: `DONE` vale 100% e qualquer outro status vale 0%
(`openspec/specs/tree-progress/spec.md`; `apps/web/src/features/board/components/BoardLanes.tsx:111,128`;
`snapshot.boxes.progressScope` no dashboard). O efeito aparece no projeto de produção
NT-my-update: 33 cards, **27 em `IN_PROGRESS`** (todos parados em "A Testar") e nenhum
concluído — então board, histórias, cabeçalho de sprint e dashboard mostram **0%**, mesmo
com o trabalho claramente avançado. Card sem checklist não tem nenhuma outra fonte de
progresso, e o dashboard ainda exibe zeros enganosos porque os 33 cards não têm pontos
(`estimationCoverage 0%`).

Além disso, a inspeção do dashboard de produção revelou defeitos objetivos: o Aging WIP
rotula o eixo com os 8 primeiros caracteres do UUID do card, a Carga da Equipe quebra os
nomes longos da equipe (colidindo os rótulos), o cartão de Horas Registradas mostra uma
descrição técnica em inglês vinda da API e vários rótulos dos gráficos estão fixos em
inglês, o que o gate de i18n não pega porque só varre TSX.

## What Changes

- **Peso por coluna**: cada coluna passa a ter um peso de avanço (0–100), com default
  derivado do `baseStatus` e da posição entre as colunas do mesmo status — `NOT_STARTED` 0,
  `DONE` 100, `IN_PROGRESS` distribuído na faixa (0, 100) (com duas colunas: 50 e 90) — e
  override explícito por coluna nas configurações do projeto.
- **Cálculo do avanço**: `avanço(card) = checklist ? faixa.início + (checked/total) ×
  (faixa.fim − faixa.início) : peso(coluna)`. O checklist afina dentro da faixa da coluna,
  então marcar itens nunca reduz o avanço; sem checklist, mudar de coluna já gera progresso.
- **Avanço × conclusão**: o avanço alimenta as barras das lanes de história, o cabeçalho de
  sprint e a Tree View; o número de conclusão (`DONE / total`) continua existindo e é o que
  sustenta escopo, burnup e a box "Progresso e Escopo".
- **Dashboard**: nova box de **Avanço** ao lado de "Progresso e Escopo"; quando a cobertura
  de estimativa for zero, a visão de pontos sai dos cartões e dá lugar a uma dica acionável;
  cobertura parcial e formatos de data/decimal passam a respeitar o locale.
- **Defeitos do dashboard corrigidos**: rótulo do Aging WIP passa a usar código/título do
  card (o contrato de detalhe expõe `sequenceCode`), nomes longos da equipe são truncados com
  tooltip, a descrição técnica de Horas Registradas deixa de ser renderizada, e os rótulos
  fixos em inglês são internacionalizados — com o gate de i18n estendido aos módulos de
  adaptação `.ts`.
- **Dado de produção**: configurar explicitamente os pesos das colunas do projeto
  NT-my-update depois do release (sem mover cards e sem preencher pontos).
- Sem mudanças incompatíveis: `DONE / total` e as respostas atuais do dashboard permanecem
  (o `sequenceCode` é um campo aditivo).

## Capabilities

### New Capabilities

- `progresso-por-coluna`: peso de avanço por coluna (default derivado e override), a regra
  de cálculo do avanço que combina coluna e checklist, e a separação entre avanço e conclusão
  na apresentação.

### Modified Capabilities

- `tree-progress`: a regra de progresso da Tree View deixa de ser `DONE` = 100% / resto = 0%
  e passa a ser o avanço por coluna, mantendo o comportamento de filtros, arquivamento e modo
  `SIMPLE`.
- `project-dashboard`: a lista de quadros passa a incluir a box de Avanço, e a ausência de
  estimativas e a cobertura parcial passam a ter tratamento explícito (dica em vez de zeros;
  explicação da origem da série).
- `dashboard-metric-rollups`: o detalhe de itens do Dashboard passa a expor o código
  sequencial do card, para rótulos legíveis nos rankings.
- `i18n`: a auditoria de texto de produto passa a cobrir também os módulos de adaptação e
  utilitários (`.ts`), não apenas componentes.

## Impact

- **Banco/schema**: novo campo de peso na coluna (`progressWeight`), anulável; migration
  aditiva, sem reescrita de dados e sem alterar o significado de `baseStatus`.
- **API**: contrato de colunas (leitura/escrita do peso), contrato do detalhe de itens do
  dashboard (`sequenceCode`) e o cálculo do avanço onde ele é derivado.
- **Web**: configurações do projeto (editor de pesos), lanes do Kanban, cabeçalho de sprint,
  Tree View, página do Dashboard, adapters de gráfico e i18n em pt-BR/en/es.
- **Scripts/gates**: `check:i18n` passa a varrer `.ts` de adaptação.
- **Dado de produção**: ajuste de configuração no projeto NT-my-update (pesos das colunas).
- **Sem novas dependências** e sem mudança de licenças.
