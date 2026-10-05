## Context

A associação de cards a sprints (`item_sprints`) e a versão de um item (`version_id`) já existem, com unicidade e rejeição de sprint `CLOSED`. O ícone de item já tem catálogo e default de renderização (`DEFAULT_ITEM_ICON = 'file-text'`, `entity-icons`), mas **não é persistido** na criação. Os caminhos de criação atuais: `POST /projects/:id/items` (`items.ts:476-620`) associa sprint apenas se `body.sprintId` vier preenchido e nunca aplica versão/ícone default; o lote (`createBatchItemInsideTransaction`, `itemUnitOfWork.ts:326-398`) não grava `item_sprints`, `version_id` nem `icon`. O card T35 pede defaults determinísticos na criação.

## Goals / Non-Goals

**Goals:**

- Ao criar TASK/BUG sem campo explícito: vincular à **sprint vigente** (OPEN + data atual no intervalo) e à **versão vigente** (próximo lançamento por data), e persistir o **ícone default**.
- Cobertura de criação individual (UI/REST/MCP `create_task`) e em lote (MCP `batch`).
- Campo explícito (ID ou `null`) tem precedência; sem candidato, criação normal.
- Determinismo total, respeitando projeto/tenant e sem duplicidade.

**Non-Goals:**

- Vincular em massa itens existentes; criar/ativar sprints ou versões automaticamente.
- Aplicar defaults a EPIC/STORY.
- Alterar a UI de criação ou adicionar toggle de projeto (escape hatch = campo explícito).

## Decisions

### 1. Política resolvida na camada de rota

A rota resolve sprint vigente, versão vigente e ícone default e passa valores explícitos ao unit of work (individual e lote). O adapter permanece burro.

- **Por quê:** concentra a regra, reaproveita validações existentes e evita consultar catálogos por item dentro da transação.
- **Alternativa:** resolver no adapter — duplicaria regra entre SIMPLE/PostgreSQL e exigiria SQL de datas.

### 2. Critérios determinísticos

- **Sprint vigente:** `status = OPEN` **e** `startDate <= hoje <= endDate`. Havendo mais de uma (janelas sobrepostas), escolher a de menor `createdAt`.
- **Versão vigente:** `status != CANCELLED`, `releaseDate != null` e `releaseDate >= hoje`; escolher a menor `releaseDate`; empate → menor `createdAt`. Versões sem data não são candidatas.
- **Ícone default:** `DEFAULT_ITEM_ICON` (`file-text`), persistido quando `icon` for omitido.
- **Hoje:** comparação por data (YYYY-MM-DD) em UTC, para determinismo independente do fuso do servidor.

- **Por quê:** "vigente" por data evita vincular a uma sprint/versão fora da janela; o desempate por `createdAt` é estável e reproduzível.
- **Alternativa:** usar só `status = OPEN` — ignoraria a exigência de "considerando as datas"; usar `position` — não reflete "criação mais antiga".

### 3. Distinção entre "omitido" e "sem valor"

`undefined` → aplica o default; `null` → não associa/limpa; ID/nome válido → usa o informado. Vale para `sprintId`, `versionId` e `icon` (individual) e para `sprintIds`/`versionId`/`icon` (lote).

- **Por quê:** escape hatch sem novo campo; `optionalId`/`optionalIcon` já aceitam `null`.

### 4. Escopo por tipo: TASK/BUG

Defaults aplicados apenas a cards de trabalho; EPIC/STORY seguem inalterados.

- **Por quê:** `sprint_cycle_items` registra folhas e o card fala em "cards"; evita inflar ciclo/progresso.

### 5. Criação em lote grava sprint, versão e ícone

`createBatchItemInsideTransaction` passa a inserir `item_sprints`, `version_id` e `icon` a partir de campos da operação; a rota de lote injeta os defaults nas operações `create_task` de TASK/BUG que omitirem os campos.

- **Por quê:** hoje o lote ignora esses campos — o fluxo mais usado pelo agente ficaria fora.
- **Alternativa:** só cobrir a criação individual — deixaria o agente de fora.

### 6. Sem mudança obrigatória no frontend

A criação rápida já omite os campos; a resposta carrega as relações (`loadItemWithRelations`) e o broadcast reconcilia o cache.

## Risks / Trade-offs

- **[Criar um card intencionalmente fora da sprint/versão passa a exigir explicitude]** → `sprintId: null`/`versionId: null`/`icon: null` documentados.
- **[Fronteira de fuso na data de hoje]** → comparação em UTC, documentada; sprint/versão que começa/termina hoje é considerada vigente.
- **[Lote de planejamento vincula muitas tarefas]** → só TASK/BUG e escape hatch explícito.
- **[Associação duplicada]** → unicidade `(itemId, sprintId)` e `replaceRelations` idempotente.
- **[Paridade PostgreSQL]** → `createItemsBatch` é `NOT_IMPLEMENTED` (como em B4); defaults em lote ficam no SIMPLE.
- **[Ícone default persistido muda o contrato de "item sem ícone"]** → `entity-icons` é ajustado: itens criados após a mudança têm ícone; `null` explícito na edição continua limpando.

## Migration Plan

- Aditivo, sem migração de dados. Cards antigos permanecem como estão; a UI continua aplicando o default de renderização quando `icon = null`.
- Rollback reverte o comportamento (nenhum estado novo a limpar além de defaults gravados após o deploy).

## Open Questions

- Deve haver um sinalizador de projeto para desligar os defaults automáticos?
- A UI deve indicar no toast de criação os vínculos aplicados?
