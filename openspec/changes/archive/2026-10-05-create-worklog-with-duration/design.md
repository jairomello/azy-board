## Context

O catálogo compartilhado (`packages/tool-registry`) é a fonte única de campos, schema, validação e descrição das ferramentas MCP. Hoje `toolFields.create_item_log` declara apenas `projectId`, `itemId` e `activity`; porém o caminho de execução já aceita duração:

- `apps/mcp/src/tools.ts:toolCreateItemLog` recebe `durationMin` e envia `POST /projects/:id/items/:itemId/logs`.
- `apps/api/src/validation.ts:itemLogSchema` e a persistência aceitam `durationMin` (minutos).
- `update_item_log` já expõe `durationMin` em `changes`.

A lacuna é só de contrato de criação. O doc `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md` (oportunidade 5) pede “um único apontamento criado com duração correta após aprovação”, com a ressalva de que data retroativa não está suportada no domínio.

## Goals / Non-Goals

**Goals:**
- Expor `durationMin` opcional na criação de apontamento, de forma rastreável e paritária entre schema, validação e executor.
- Aceitar duração humano-legível (`1h30`, `1h`, `90min`, `1:30`) e normalizá-la para minutos antes da validação, do preview, do hash e da execução.
- Mostrar atividade e duração na prévia de aprovação.
- Garantir que a repetição do mesmo apontamento não crie registro duplicado.
- Manter a duração consistente com o que o painel Diário já totaliza.

**Non-Goals:**
- Data retroativa: o domínio não suporta data escolhida no apontamento (`NewItemLogRecord` grava `createdAt = agora`); não será prometida nem aceita.
- Idempotência HTTP entre requests/retries fora da run do agente (as rotas de log não usam `Idempotency-Key` hoje).
- Alterar o formulário do painel Diário ou seu formato `H:MM`.
- CRUD de links, anexos e demais oportunidades do doc de evolução.

## Decisions

### 1. Dois campos: `durationMin` canônico + `duration` legível
`create_item_log` passa a aceitar `durationMin` (inteiro de minutos) e `duration` (string humano-legível) — mesmo par de nomes já usado na API (`itemLogSchema`/`workLogSchema`). `durationMin` é a forma canônica; `duration` é uma conveniência de entrada normalizada. Se ambos vierem e os minutos divergirem, a validação rejeita com mensagem acionável.
- **Por que não só `durationMin`**: o card exige interpretar `1h30` como 90; delegar a conversão apenas ao modelo não é testável nem garante consistência com o preview.
- **Alternativa descartada**: aceitar string no próprio `durationMin` — enfraquece o tipo declarado e a coerção guiada pelo schema.

### 2. Parser dedicado no tool-registry, não no parser `H:MM` do frontend
Novo parser de duração em `packages/tool-registry` (usado por validação e harness) aceita `H:MM`, `1h30`, `1h`, `90`, `90min`, `90m`, `1h30min`, com minutos `00–59` quando houver separador de hora, e rejeita negativos/inválidos.
- **Por que não estender `parseWorkDuration` de `packages/ui-contracts`**: a spec `card-work-log` exige que o formulário do Diário rejeite formatos fora de `H:MM`; ampliar o parser compartilhado mudaria esse comportamento. O parser novo é exclusivo do caminho de ferramenta/agente.

### 3. Normalização antes de validar, prever e hashear
O harness já aplica coerção guiada pelo schema e persiste os argumentos coeridos (`mcp-tool-registry` — “Harness do agente coerge antes de aprovar”). A normalização de duração entra nesse mesmo ponto, de modo que preview, hash de operação e execução usem `durationMin` numérico.
- **Consequência desejada**: `create_item_log` com `duration: "1h30"` e com `durationMin: 90` produzem o **mesmo** payload canônico; logo o dedup por assinatura do harness trata como a mesma operação (ver decisão 4).
- **Alternativa descartada**: normalizar só no executor MCP — o harness interno não passaria pelo executor MCP e ficaria divergente do preview/hash.

### 4. Anti-duplicação reaproveita o dedup existente do harness
O harness já deduplica mutações por assinatura `name + operationHash(args)` (`REPEATED_TOOL_CALL` para repetição não resolvida; `alreadyExecuted` na retomada pós-aprovação). Com a normalização canônica de duração, repetir o mesmo apontamento não cria novo registro. A cobertura de teste é da capability `azy-agent-harness`.
- **Alternativa descartada**: propagar `idempotencyKey` ao `POST .../logs` — as rotas de log não têm idempotência e adicioná-la é mudança de API fora do escopo do card. Fica registrada como risco residual.

### 5. Prévia formatada em pt-BR
Adicionar ramo dedicado em `approvalPreview` para `create_item_log`/`update_item_log` exibindo atividade e duração legível (`90 min (1h30)`), em vez do fallback que despeja o JSON cru. Mantém o hash e o alvo efetivo já existentes.

## Risks / Trade-offs

- **Duplicação entre runs/retries de rede** → fora do dedup por run; mitigação parcial só futura (idempotência na rota de log). Registrado explicitamente como não resolvido nesta mudança, para não prometer garantia inexistente.
- **Ambiguidade `duration` × `durationMin`** → regra de conflito determinística e mensagem acionável; teste de contrato cobre o caso.
- **Divergência catálogo × executor** → o gate `bun run test:mcp-catalog` + `registry-contract.test.ts`/`optional-fields.test.ts` reprovam schema/validação/dispatch inconsistentes.
- **Regressão no Diário (H:MM)** → parser novo não toca `packages/ui-contracts`; `apps/web` permanece com o comportamento atual.
- **Retorno da API** → `POST .../logs` pode não devolver `durationMin`; a confirmação deve vir do catálogo/resposta sem exigir releitura pesada. Ajuste pontual se necessário.

## Migration Plan

Mudança aditiva e opcional, sem migração de dados. Publicar catálogo → normalizador/validação → executor MCP → preview → skill. Rollback = reverter o commit; nenhum dado persistido depende do novo contrato.

## Open Questions

- Devolver `durationMin` no corpo de `POST .../logs` (hoje retorna `{ id }`) ou confiar no payload canônico já validado? Resolver na implementação, priorizando resposta autoexplicativa sem releitura.
