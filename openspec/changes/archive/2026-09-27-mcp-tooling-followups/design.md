Board refs: `6e02905a-82d7-4562-b9bc-376548a3031f`, `741f2306-12c3-4ee2-84a1-5f8cc27483db`, `e50f3019-94ff-4e6a-9ae4-f164ecd78d15`, `f1438f61-643c-4517-bbaa-5277198d6cb8`

## Context

O MCP já possui catálogo compartilhado, validação e contrato de erro normalizado, mas
quatro lacunas prejudicam o ciclo agente → mutação → confirmação: respostas de
`update_items` misturam identidade com mudanças, `list_tasks` pode retornar descrições
e relações demais, erros de chamadas não orientam recuperação e checklists exigem uma
cadeia de IDs para cada passo.

Os cards estão em `Backlog`/`NOT_STARTED`; esta change documenta o trabalho sem iniciar
nenhum deles. A implementação deverá preservar o isolamento tenant, a regra de cards
folha e o modo estrito do Azy Agent. O bug do harness que mescla chamadas paralelas é
externo ao repositório; aqui será documentado e o comportamento do agente será tornado
mais resiliente sem tentar corrigir o runtime externo.

## Goals / Non-Goals

**Goals:**

- Tornar a resposta de atualização autoexplicativa e confirmável sem reler o board.
- Reduzir o payload padrão de `list_tasks` sem eliminar consultas detalhadas explícitas.
- Padronizar recuperação de JSON inválido e mensagens de erro que indiquem a próxima
  chamada mínima possível.
- Permitir localizar checklist por nome/texto com tratamento determinístico de zero e
  múltiplos resultados.
- Fornecer atualização em lote de passos de checklist com limite e atomicidade claros.
- Manter catálogo, API, MCP, skill e testes sincronizados.

**Non-Goals:**

- Corrigir o runtime/harness do OpenCode ou abrir issue automaticamente em outro
  repositório.
- Alterar o modelo persistido de checklist ou a UI web.
- Remover imediatamente os caminhos atuais por IDs.
- Introduzir cache, WebSocket replay ou uma nova camada de transporte.
- Permitir que uma busca semântica escolha silenciosamente entre itens duplicados.

## Decisions

### D1. Resposta de atualização com identidade e mudança separadas

`update_item` e `update_items` passarão a retornar uma forma aditiva e explícita:

```json
{
  "matchedCount": 51,
  "updatedCount": 51,
  "applied": { "sprint": { "id": "...", "name": "Sprint 0" } },
  "items": [{ "id": "...", "identity": { "title": "..." }, "changes": { "sprint": { "id": "...", "name": "Sprint 0" } } }]
}
```

`changes` passa a significar somente valores aplicados; `identity` concentra os dados
usados para reconhecer cada item. `matchedCount` e `updatedCount` permanecem. Quando
os valores variam por item, `applied` será omitido ou representará apenas o resumo
comum, enquanto cada item manterá seu próprio `changes`.

_Alternativa rejeitada:_ apenas renomear o campo atual. Isso removeria a ambiguidade,
mas não entregaria o valor aplicado, mantendo a necessidade de uma reconsulta.

### D2. `list_tasks` usa defaults leves e projeção declarativa

O catálogo e o executor aceitarão `includeDescriptions` (default `false`), `limit`
(default 50, limitado a 100), `cursor` e `fields` opcional. Sem `fields`, a projeção
leve incluirá identificação, título, status, coluna, tipo, leaf e relações achatadas
(`sprintId`, `sprintName`, `tagIds`, `tagNames` quando disponíveis). Com
`includeDescriptions: true`, descrições completas serão retornadas; `fields` restringe
o conjunto final sem permitir campos desconhecidos.

_Alternativa rejeitada:_ criar uma ferramenta separada de confirmação. Manter uma só
`list_tasks` evita que agentes tenham de descobrir outro catálogo e permite migração
gradual por parâmetros.

### D3. Mensagens acionáveis e recuperação de JSON inválido

Mensagens de validação e erro MCP deverão conter código estável, causa, campos rejeitados
e um snippet mínimo quando a falha for de formato. A skill instruirá: em erro de parsing
JSON da chamada, repetir uma única vez com a chamada isolada, sem paralelismo; se falhar
novamente, reportar a ferramenta, o payload mínimo esperado e o erro sem inventar que a
operação foi executada.

`get_current_sprint` continuará sem criar sprint implicitamente. Quando não houver
sprint ativa, a resposta será aditiva (`status: NONE`, `nextSteps` com listar/ativar),
sem transformar ausência em erro retryable.

### D4. Retry é controlado pelo envelope, não por status HTTP

O MCP preservará `retryable` e `details` da API. Clientes e skill não repetirão erros
permanentes de validação, autorização ou conflito. Apenas falhas de parsing local da
chamada terão o retry isolado documentado; falhas transitórias da API seguirão o
`retryable: true` e, quando presente, `Retry-After`.

### D5. Resolução semântica de checklist com IDs como fallback

`check_item` e `update_checklist_item` aceitarão um modo semântico com `itemId`,
`checklistName` e um identificador textual do passo (`text`, com `position` opcional
para desempate). O servidor resolverá o checklist por nome exato dentro do card e o
passo por texto exato normalizado; zero resultados produzirão erro acionável e múltiplos
resultados exigirão `checklistId`/`checklistItemId` ou `position`. Se IDs forem enviados,
eles continuam sendo a rota canônica e não serão cruzados silenciosamente com nomes.

Uma nova ferramenta `check_items` receberá uma lista limitada de operações semânticas
ou por IDs e executará todas atomicamente por card, retornando `matched`, `updated` e
os conflitos por operação. O limite inicial será 100 passos por chamada.

_Alternativa rejeitada:_ remover os IDs. IDs continuam necessários para resolver
duplicidades e para integrações determinísticas.

### D6. Fonte única para contratos e documentação

Novos parâmetros, campos de resposta e a ferramenta de lote serão descritos no
`packages/tool-registry`, consumidos por API/MCP, cobertos pelos testes de catálogo e
replicados na skill oficial. A implementação não criará listas paralelas de campos ou
mensagens por aplicação.

## Risks / Trade-offs

- **[Mudança observável no payload padrão de `list_tasks`]** → documentar o breaking
  change, preservar `includeDescriptions: true` e cobrir consumidores no smoke/E2E.
- **[Consumidor depende do significado antigo de `items[].changes`]** → incluir
  `identity` explicitamente, atualizar contratos e manter contagens; registrar migração
  no changelog.
- **[Projeção omite campo usado por um agente]** → rejeitar nomes desconhecidos e permitir
  `fields` explícito; a skill orientará a pedir detalhes somente quando necessários.
- **[Texto de checklist duplicado]** → não escolher automaticamente; retornar conflito
  com candidatos suficientes para a chamada seguinte.
- **[Lote parcial por um passo inválido]** → transação atômica por card, limite fixo e
  resposta sem alteração quando qualquer operação falhar.
- **[Retry duplicar mutação transitória]** → somente repetir conforme `retryable` e a
  política do método; parsing inválido ocorre antes da execução da ferramenta.
- **[Skill e catálogo divergirem]** → rodar `bun run test:agent-skill` e os testes de
  contrato MCP como gate obrigatório.

## Migration Plan

1. Mapear os payloads atuais de `update_item`, `update_items`, `list_tasks` e checklist
   nos executores e testes E2E.
2. Adicionar contratos no registry e implementar respostas/parâmetros de forma aditiva
   onde possível.
3. Alterar API/MCP, skill e documentação no mesmo change; incluir CHANGELOG com a
   alteração de default de `list_tasks`.
4. Rodar `bun run check`, `bun run test:smoke`, `bun run test:agent-skill` e a suíte de
   regressão MCP.
5. Rollback: restaurar o executor/schema anterior e manter clientes usando os parâmetros
   antigos; não há migração de banco.

## Open Questions

- Confirmar durante a implementação o nome final do campo textual semântico do passo
  (`text` versus `itemText`) e o formato exato de `fields` no catálogo.
- Confirmar se a resposta atual da API já carrega `sprintName`/`tagNames` ou se a
  projeção precisará de consultas/joins adicionais.
- Abrir o issue externo do harness de paralelismo manualmente quando o repositório de
  destino e o link estiverem disponíveis.
