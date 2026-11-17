# Design

## Contexto

O board posiciona cards por `columnId` e exibe o status como consequência do `baseStatus`
da coluna. A grade da árvore, o seletor de status da modal e as ferramentas MCP atualizam
`status` sozinhos; o endpoint de movimento (`/move`) é o único que grava os dois campos
juntos. Daí a divergência observada em produção.

## Decisão — reconciliar no caso de uso, não na UI

**Escolhido:** `updateItemApplication` reconcilia os campos antes de montar o patch, usando
`reconcileStatusAndColumn` (função pura, testável).

**Por quê:** todos os caminhos de edição passam pelo mesmo caso de uso (REST, MCP e grade,
que usam `PATCH /items/:id`). Corrigir na UI exigiria repetir a regra na modal, na grade e
em cada ferramenta, e deixaria o contrato da API inconsistente para integrações.

**Regras:**

| Entrada | Resultado |
| --- | --- |
| `status` sem `columnId` | primeira coluna (ordem do fluxo) com o mesmo `baseStatus` |
| `columnId` sem `status` | `status` = `baseStatus` da coluna |
| os dois juntos | coluna manda no `status` |
| `status` sem coluna correspondente | card permanece onde está |
| item não móvel (`EPIC`) | coluna intocada |

**Consequência:** `IN_PROGRESS` vai para a primeira coluna em andamento (ex.: **Fazendo**),
não para "A Testar"/"Testando". Quem quiser a etapa específica move o card pela coluna.
A posição no destino é preservada, como no claim já existente; o primeiro reorder na coluna
reorganiza a fila.

## Alternativas descartadas

- *Derivar a coluna na leitura do board a partir do status:* escolheria uma coluna
  arbitrária quando várias compartilham o mesmo `baseStatus` e esconderia a inconsistência
  sem corrigir o dado.
- *Rejeitar `status` sem `columnId` com 400:* quebraria a grade, a modal e os agentes que
  hoje editam apenas status.
- *Backfill global:* arriscado em produção e desnecessário para o caso; o card afetado é
  corrigido pelo fluxo normal de movimento.
