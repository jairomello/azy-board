# Design

## Context

A regra de avanço por coluna já existe e está em produção: `computeAdvance` e `resolveColumnProgressWeights` vivem em `packages/domain/src/progress.ts` e são usadas pelas lanes do board, pela árvore (no servidor) e pelo dashboard. O card do Kanban ficou de fora: `KanbanCard` só conhece o `card` e desenha a barra a partir de `checklistProgress`.

O card tem `columnId`, e o board já carrega as colunas do projeto com o peso efetivo (`progressWeight`) e o valor explícito (`progressWeightOverride`). Nada novo é necessário no servidor.

Para nomes, não há regra alguma hoje: cada superfície exibe o nome completo que vem do catálogo de membros ou do autor do log.

## Goals / Non-Goals

**Goals:**

- O card exibir o mesmo avanço que a lane, a árvore e o dashboard mostram para ele.
- Nomes longos não quebrarem layouts de leitura, sem perder a identificação da pessoa.

**Non-Goals:**

- Congelar o avanço de item bloqueado no último peso conhecido (exigiria histórico por item).
- Refinar o avanço do dashboard por checklist (o dashboard agrega por coluna).
- Abreviar nomes em campos de escolha (selects) e no modal de item.
- Iniciais/avatares: `UserAvatar` já usa duas letras e não muda.

## Decisions

### D1 — O avanço é calculado no board e passado ao card

`BoardColumns` recebe `columns` e resolve os pesos uma única vez por render (`resolveColumnProgressWeights` sobre os valores explícitos), calculando o avanço de cada card com `computeAdvance`, usando o peso da coluna anterior como piso. O card recebe `advance?: number` como prop **opcional**, o que preserva o `DragOverlay` do board e os testes que renderizam o card apenas com `card`.

**Alternativa descartada:** o card resolver os pesos sozinho a partir do `columnId`. Isso exigiria passar a lista de colunas ao card e repetiria a resolução por card.

### D2 — A barra é o avanço; o contador continua sendo do checklist

A barra passa a representar o avanço e aparece quando ele for maior que zero. O contador `marcados/total` continua sendo exibido quando existe checklist, porque é informação distinta (quantos itens do checklist foram marcados). Sem checklist, a barra mostra o peso da coluna e nenhum contador aparece.

**Alternativa descartada:** duas barras (checklist e avanço). Duplicaria o indicador em um card estreito (292 px) e o checklist já é representado pelo contador.

### D3 — Rótulo acessível explícito

A barra ganha `title`/`aria-label` "Avanço no fluxo: X%" vindo de chave de tradução, para que a leitura assistiva não confunda a barra com conclusão.

### D4 — Nomes: primeira + última parte, 15 caracteres

Um helper compartilhado no web aplica, em ordem:

1. normaliza espaços (inclusive espaços múltiplos);
2. se houver mais de duas partes, mantém a **primeira e a última** ("Thiago Corrêa Simas de Melo Porto" → "Thiago Porto");
3. se o resultado passar de **15 caracteres**, corta e acrescenta "…";
4. devolve o nome completo separadamente para `title`/`aria-label`.

O limite de 15 caracteres vem da medição do eixo "Carga da Equipe": a calha tem 124 px com fonte de 11 px e o recharts quebra o rótulo em duas linhas a partir de ~88 px. Nas medições, "Francisco Prestes" (17 caracteres, 85 px) fica em uma linha e "Lorenzo Dall'Agnol" (18 caracteres, 92 px) quebra; com 15 caracteres o pior caso medido ("Maximiliano Fe…") fica em 85 px e permanece em uma linha.

**Alternativas descartadas:** duas primeiras partes ("Thiago Corrêa") — menos identificável quando o sobrenome final é o usado; corte cego por caracteres — foi o que motivou o ajuste (perdia o sobrenome); alargar a calha do eixo — encolheria o gráfico em vez de resolver o rótulo.

### D5 — Superfícies

A regra vale para chips de filtro ativo do board, eixo da carga da equipe (dashboard) e coluna Responsável da árvore. Campos de escolha e modal de item ficam com o nome completo, porque ali a identificação precisa ser exata.

## Riscos

- Nomes distintos podem colidir visualmente ("Thiago Porto" × "Thiago Portela"): o tooltip com o nome completo é a mitigação.
- A barra passa a aparecer em todo card em coluna de trabalho (antes só com checklist): é mudança visual intencional, verificada em densidade normal e compacta.

## Migration Plan

Sem migração de dados. A regra de peso já está aplicada nas colunas (o projeto de produção tem "Fazendo" = 50 e "A Testar" = 90 configurados explicitamente).
