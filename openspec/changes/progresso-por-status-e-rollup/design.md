# Design

## Regra da folha

`createAdvanceResolver(columns)` devolve `(item) => number | null`:

| Status | Avanço |
|---|---|
| `CANCELLED`, `ARCHIVED` | `null` (fora da conta) |
| `DONE` | 100 |
| `NOT_STARTED`, `PLANNED` | 0 |
| `IN_PROGRESS`, `IN_HOMOLOGATION` | faixa da própria coluna se `baseStatus` igual; senão faixa da 1ª coluna desse status; sem nenhuma, 50 / 90 |
| `BLOCKED` | faixa da própria coluna se ela é do fluxo; senão 0 |
| sem status | regra anterior, só pela coluna |

"Faixa" é `computeAdvance` (peso da coluna, afinado pelo checklist entre o peso da coluna anterior e o da coluna). Assim o checklist continua refinando, e marcar itens nunca reduz o avanço.

## Agrupador

A árvore acumula as folhas de baixo para cima e o agrupador é a média das folhas válidas — matematicamente igual à média das filhas ponderada pelo número de folhas de cada uma. Sem folhas: 0% (comportamento anterior). Só com canceladas: `null` ("—").

## Agregados SQL

Dashboard e listagem de projetos já agrupam por `status` e `column_id`. `aggregatedAdvance(columns, rows)` aplica a mesma regra por linha agregada, com peso `count`. O recorte de folhas passa a aceitar `STORY` e `EPIC` sem filhos e exclui a STORY fixa do modo `SIMPLE` (`projects.simple_story_id`).

## Alternativas descartadas

- **Média simples das filhas**: no projeto real dá 57% contra 69%, porque a Fase 1 (8 itens) pesaria o mesmo que a Fase 2 (226).
- **Corrigir só os cancelados**: leva o projeto de 47% para 50%; a maior parte do erro vem do desencontro status × coluna.
- **Ponderar por pontos**: inviável hoje (0 pontos em 100% das folhas).
