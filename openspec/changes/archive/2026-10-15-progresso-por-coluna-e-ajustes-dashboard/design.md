# Design

Board ref: T66–T73 e B8–B11 (cards do projeto Azyboard)

## Context

Ver `proposal.md` para motivação. Estado atual e restrições que moldam a solução:

- Progresso é binário em três lugares: `BoardLanes.tsx:111,128` (`status === 'DONE'`),
  `openspec/specs/tree-progress/spec.md` (DONE = 100%, resto = 0%) e o
  `snapshot.boxes.progressScope` do dashboard.
- Colunas já têm `baseStatus` (`NOT_STARTED`/`IN_PROGRESS`/`BLOCKED`/`DONE`) e a tela de
  configurações do projeto já escolhe esse status ao criar/editar coluna
  (`ProjectSettingsScreen.tsx`), então existe onde pendurar o peso.
- Checklist já existe por card (`checklistProgress: { checked, total }`, propagado em tempo
  real em `useBoardData.ts`), mas hoje só aparece no próprio card.
- O dashboard deriva rótulos em `apps/web/src/dashboardAdapters.ts` (`.ts`), fora do alcance
  do `check:i18n`, que varre TSX por AST.
- O detalhe de itens do dashboard não expõe `sequenceCode` (só `id` e `title`).
- Dado real do NT-my-update: 33 folhas, 27 em `IN_PROGRESS`, 0 concluídas, `points: null` em
  todas, cobertura de analytics desde 13/10/2026.

## Goals / Non-Goals

**Goals:**

- Cards sem checklist passarem a ter avanço, sem trabalho manual de configuração.
- Manter a conclusão como indicador honesto de entrega, sem redefinir escopo e burnup.
- Corrigir os defeitos objetivos do dashboard com causas localizadas e verificáveis.
- Deixar o NT-my-update refletindo o avanço real depois do release.

**Non-Goals:**

- Mover cards entre colunas ou preencher estimativas no projeto de produção.
- Substituir `DONE / total` por avanço em escopo, burnup ou cobertura de estimativa.
- Adicionar um décimo primeiro quadro ao dashboard.
- Congelar o avanço de itens bloqueados no último peso conhecido (exige histórico de eventos).
- Recalcular retroativamente séries históricas do dashboard com a nova régua.

## Decisions

### D1. Peso derivado por padrão, override por coluna

Novo campo anulável `progressWeight` na coluna. Sem valor explícito, o peso é derivado do
`baseStatus` e da posição entre as colunas do mesmo status: `NOT_STARTED` = 0, `DONE` = 100,
`BLOCKED` = peso da própria coluna, `IN_PROGRESS` = faixa aberta (0, 100) distribuída na
ordem das colunas (duas colunas → 50 e 90).

Alternativas consideradas:

- **Só `baseStatus`** (ex.: tudo em `IN_PROGRESS` = 50): mais simples, mas não distingue
  "Fazendo" de "A Testar" — que é justamente o que o time quer ver.
- **Só configuração manual**: exige setup em todo projeto novo e não resolve o caso do
  NT-my-update sem intervenção.
- **Peso só por pontos**: o projeto não tem estimativas; ficaria igualmente zerado.

### D2. O checklist afina dentro da faixa da coluna

```
faixa(coluna) = [peso(coluna anterior no fluxo), peso(coluna)]     # início 0 na primeira coluna após NOT_STARTED
avanço(card)  = checklist.total > 0
                ? faixa.início + (checked/total) × (faixa.fim − faixa.início)
                : peso(coluna)
```

Escolhida por garantir **monotonicidade**: marcar itens nunca reduz o avanço e mover o card
para uma coluna de peso maior nunca reduz.

Alternativas consideradas:

- **Checklist substitui o peso**: um card em "A Testar" com 2 de 10 itens marcados apareceria
  com 20% enquanto um card sem checklist na mesma coluna apareceria com 90% — inversão que
  desincentiva preencher checklist.
- **`max(peso, checklist)`**: um card em "Fazendo" com checklist completo apareceria com 100%
  sem estar concluído.

### D3. Avanço e conclusão são indicadores distintos

As barras de agrupador, o cabeçalho de sprint e a Tree View passam a mostrar o **avanço**. O
número **concluído** (`DONE / total`) continua existindo, aparece junto no cabeçalho e é o que
sustenta escopo, burnup e cobertura de estimativa.

No dashboard, o avanço entra **dentro** do quadro "Progresso e Escopo", como segundo
indicador rotulado. Alternativa considerada: um décimo primeiro quadro dedicado — rejeitada
porque a spec enumera deliberadamente os quadros e porque a página já é alta; o indicador
junto da conclusão é onde a comparação faz sentido.

### D4. Item bloqueado não inventa histórico

Coluna `BLOCKED` usa o peso da própria coluna e o item é marcado como bloqueado (o dashboard
já o contabiliza em subconjunto separado). A variante "congelar no último peso não bloqueado"
depende do histórico de eventos por item e fica fora desta change.

### D5. Derivação do peso em um único ponto, no servidor

A API resolve o peso efetivo de cada coluna (explícito ou derivado) e devolve no contrato de
colunas. O web só aplica a fórmula do avanço (peso da coluna + checklist), sem reimplementar a
derivação. Isso mantém uma única definição da regra e faz board, árvore e dashboard
concordarem por construção.

### D6. Correções do dashboard com causa localizada

| Defeito | Causa | Correção |
|---|---|---|
| Aging WIP rotula com UUID | `rankingData`: `name: item.id.slice(0, 8)` | rótulo por `sequenceCode` (campo aditivo) com fallback no título; título completo no tooltip |
| Horas Registradas em inglês | `ProjectDashboardPage.tsx:140` renderiza `hours.semantics` | nunca renderizar `semantics`; usar a chave de tradução |
| Carga da Equipe ilegível | `teamLoadData`: `name: member.userName` sem limite | truncar com reticências + tooltip e alargar a calha do eixo |
| Rótulos fixos em inglês | literais em `dashboardAdapters.ts` (`.ts`) | chaves de tradução nos três idiomas; `check:i18n` passa a varrer `.ts` de adaptação |
| Pontos zerados como resultado | cobertura de estimativa 0 | omitir as visões de pontos e orientar a estimar |
| Datas/decimais fora do locale | eixos com ISO e ponto decimal | helpers de formatação por locale |
| Cartões vazios e legenda duplicada | layout | estado vazio compacto, legenda única, unidade não repetida |

### D7. Dado de produção do NT-my-update

Depois do release, definir explicitamente o peso das colunas do projeto (sugestão: "Fazendo"
= 50, "A Testar" = 90), sem mover cards e sem preencher pontos. O default derivado já levaria
o avanço a ~74%; o valor explícito documenta a intenção do time e sobrevive a mudanças futuras
de ordem/quantidade de colunas. Reversível restaurando o valor derivado.

## Risks / Trade-offs

- **[O peso é uma opinião]** → defaults derivados do `baseStatus` (que o time já escolhe) e
  override explícito; nenhum projeto fica sem valor razoável.
- **["A Testar" a 90% pode parecer entrega]** → o número de conclusão permanece separado e
  rotulado, e o topo da faixa `IN_PROGRESS` fica abaixo de 100 por construção.
- **[O percentual pode saltar ao mover o card com checklist]** → é o comportamento pretendido
  (a coluna é o sinal grosseiro, o checklist o fino); a monotonicidade garante que nada
  regride dentro da mesma coluna.
- **[Estender `check:i18n` a `.ts` pode acusar literais pré-existentes]** → o gate é ampliado
  para os módulos de adaptação que produzem rótulos exibidos, e o que ele acusar é corrigido
  nesta change.
- **[`sequenceCode` no contrato do dashboard]** → campo aditivo; os campos atuais permanecem.
- **[Ajuste de dados em produção]** → só depois de validar o release, com o default derivado
  como fallback, e reversível.
- **[Projetos `SIMPLE`]** → a regra é por coluna, então vale igualmente para a história fixa.

## Notas de implementação

- **Coluna `BLOCKED` na faixa do fluxo**: a redação original ("peso da própria coluna") era
  circular. Na implementação, colunas `IN_PROGRESS` e `BLOCKED` participam juntas da faixa do
  fluxo distribuída na ordem (a última vale 90); congelar no último peso não bloqueado exigiria
  o histórico de eventos por item e segue fora de escopo.
- **Avanço no dashboard por média ponderada**: o dashboard agrega por status, responsável e
  **coluna** em SQL e calcula `Σ(quantidade × peso da coluna) / total` — exato para a regra do
  peso de coluna, que é a que a spec do dashboard exige. O refinamento por checklist posiciona o
  card dentro da faixa onde ele aparece individualmente (board e árvore).
- **`sequenceCode` no detalhe do dashboard**: campo aditivo; o rótulo do ranking usa código ou
  título e o tooltip mostra o título completo, sem identificador técnico.
- **Adapters do dashboard**: os quatro helpers que ninguém consumia (`distributionData`,
  `comparisonData`, `overdueAgeData`, `agingData`) foram removidos — eram código morto com
  rótulos em inglês e seriam acusados pelo gate de i18n. Os que ficaram recebem o tradutor como
  parâmetro obrigatório, sem fallback literal.
- **Gate de i18n**: já varria `.ts` (`collectFiles` inclui `(ts|tsx)`), então a task 4.3 virou
  "verificar a cobertura e corrigir o que ele acusa" — ele acusou a chave dinâmica do adapter,
  corrigida — mais um teste comportamental para os rótulos que a heurística não enxerga.

## Migration Plan- **Schema**: campo anulável na coluna, sem backfill (nulo = derivado). Migration aditiva.
- **Deploy**: rollout normal de imagem; nenhuma migração de dados de card.
- **Rollback**: reverter a imagem; a coluna anulável é inofensiva e o cálculo volta ao
  comportamento anterior.
- **Dado de produção**: aplicar os pesos do NT-my-update após validar o release e conferir o
  avanço no board e no dashboard.
