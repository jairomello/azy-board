# Design — Otimização de desempenho do Azy Agent (payloads de descoberta)

## Context

Run típica de chat (ex.: `ad06a96b`, "quantos cards estão na tela na coluna backlog?"):

1. O frontend já computa e exibe localmente o recorte (`Resultado atual: 31 cards exibidos (com filtro)`) e envia no run o `screenSnapshot` (T16) com `displayedCount: 31` e `displayedItemIds`.
2. O servidor, porém, **não devolve esse recorte ao modelo** no contexto confiável — a instrução de sistema termina em `selectedProject` e o user message tem só o texto da pergunta.
3. O modelo tenta responder "de verdade": chama `get_board` com `{}` (~121 KB compactos para 89 itens); o transcript infla; a 2ª inferência salta para ~30K tokens; no tenant de 60s de `timeoutMs`, `FAILED/TIMEOUT` (ou `PAYLOAD_LIMIT` com teto menor).
4. Por pergunta, o modelo paga a mesma descoberta de novo, e cada round-trip de provider custa 8–20s com o modelo atual.

Ferramentas e pontos de fixação existentes: `executeSharedTool`/`getSharedToolDefinitions` (registry compartilhado), `compactLongText` (preview de 160 chars), `toolOutputForTranscript` (Card B7, teto de 32.000 chars por output), `formatAssistantPromptContext` (2ª mensagem de sistema), `canonicalArguments` (injection de projectId/snapshot).

## Goals / Non-Goals

**Goals:**
- Pergunta de recorte/contagem sobre a tela respondida em **1–2 passos** com prompt ≤ ~8K tokens, sem falha e sem contexto faltando.
- Redução estrutural (não só clamping) do payload default de `get_board`/`get_tree`.
- Leituras independentes agrupadas no mesmo passo (menos round-trips).
- Zero mudança de comportamento para o usuário humano do Kanban.

**Non-Goals:**
- Latência de provider (OpenRouter/modelos) — de terceiros; fora do escopo.
- Mudar contratos REST (`/projects/:id/board` etc.).
- Streaming de tools, memoização entre conversas ou RAG/índices persistentes.
- O spec de orçamento/custos existente (`ai-provider-configuration`) não tem requisitos alterados.

## Decisions

**D1 — Digest do recorte injetado no contexto confiável (caminho zero-step).**
Quando o run chega com `screenSnapshot.results` preenchido (`scope FILTERED`), `formatAssistantPromptContext` passa a incluir um bloco `screenOverview` compacto: `{ displayedCount, totalMatchingCount, columns: [{ name, total, TASK, BUG }], scope, filterSummary }` — 1–2 KB, computado server-side a partir dos IDs + dados reais dos itens (o servidor revalida autorização como hoje). A pergunta de contagem fica respondida **antes de qualquer tool call**; o modelo explica, sem inferir.
*Alternativa considerada:* só instruction no prompt ("seu recorte está no snapshot") — descarta o problema do eb/ad sem código novo, mas deixa a cargo do modelo acertar o caminho; com o bloco pronto o ganho é determinístico.
*Alternativa descartada:* enviar os 31 IDs brutos (infla transcript e vira prompt de novo).

**D2 — `get_screen_overview` para descoberta fora do snapshot.**
A pergunta pode ir além do recorte ("e no board inteiro?"; sem snapshot em telas globais). Novo tool READ, classificação `{ domain: 'board', scope: 'project', operation: 'read' }`, schema estrito `{ projectId, scope: 'SCREEN'|'PROJECT', sprint?: 'CURRENT'|id }`, saída = mesma forma do D1 + amostra dos ~20 primeiros `sequenceCode|title` por coluna. Implementação reusa `toolGetBoard(api, projectId, false)` + agregação — uma única chamada HTTP interna, resposta ~2–5 KB, nunca acima do teto B7. Adicionado a `discovery` do tool-registry e ao roteamento de intenções `read`.
*Alternativa considerada:* encolher `get_board`. Mantém uma só ferramenta, mas mistura duas necessidades (recorte ≠ dump), continua custo único alto para dump.

**D3 — Modo `summary` default em `get_board`/`get_tree` (MCP incluído).**
Item sem `includeDetails=true` devolve projeção de 9 campos (id, sequenceCode, title, type, status, columnId, priority, assigneeId, points); `includeDetails=true`	devolve a forma completa de hoje (compactada por `compactLongText`). 89 itens × ~350 chars ≈ **31 KB** (−75%). O esquema MCP marca `includeDetails` opcional — catálogo/README regenerados.
*BREAKING (MCP):* clientes que leram campos pesados sem opt-in passam a recebê-los ausentes; `compactLongText` já tornava o formato tolerante a truncamento.
*Alternativa considerada:* paginação em vez de projeção — mantém paridade de campos, mas multiplica steps (o que queremos reduzir).

**D4 — "Descoberta em um passo" no system prompt.**
Três regras adicionadas a `AZY_AGENT_SYSTEM_PROMPT`: preferir o bloco `screenOverview`/snapshot; emitir **leituras independentes juntas no mesmo passo** (o harness já processa vários calls por turno); `get_board` full apenas quando o recorte não cobre e o item de interesse é conhecido. (Sem mudança de código no loop `while` — só texto + tool descriptions.)

**D5 — Conteúdo e revalidação.**
O digest carrega `contextId`/`capturedAt` do snapshot e a frase "os contadores refletem o rec capturado no momento da pergunta" elimina a ambiguidade de consistência temporal (mesmo padrão do T16: títulos/IDs são dados, nunca instruções). Para `get_screen_overview`, contagem é calculada no banco na hora — sempre atual.

## Risks / Trade-offs

- [Digest reflete o recorte capturado, não o estado atual do board] → texto explícito no contexto + `get_screen_overview` disponível para o estado atual; nenhum mutação usa digest.
- [Modelo ignorar as instruções e chamar `get_board` mesmo assim] → o payload passa a ser pequeno (D3), logo o custo de "errar a escolha" cai de ~30K tokens para ~8K; risco residual aceitável.
- [Slice do B7 produz JSON inválido no transcript] → já existia pós-B7; o aviso `TRUNCADO` orienta refaça-a consulta; sem alteração de comportamento além do aviso.
- [BREAKING MCP para clientes que exigem campos pesados] → opt-in documentado no README do MCP e na tabela de limites; change openspec dá o caminho de migração.
- [Muse-spark lento por passo] → mitigado por menos passos; não eliminado (non-goal).

## Migration Plan

1. Contratos e tool-registry (tipos, discovery set, classificação) + testes de contrato.
2. Tools: `get_screen_overview` e modo `summary`; `generate:docs` para catálogo/README/OpenAPI.
3. Injeção do bloco `screenOverview` em `formatAssistantPromptContext` + regras de prompt.
4. Verificação: `bun run check`; smoke do chat local com banco de laboratório e provider stub; E2E visual dos guardas existentes.
5. Deploy: labapps (pull + deploy-all.sh). Rollback: revert do commit — sem migrations de banco envolvidas (digest é derivado, nada persistido por ele na conversa além do próprio run).

## Open Questions

- Qual teto de itens por amostra no digest (20 escolhido; ajustar após uso)? Mantido como constante do contrato e revisável.
- Habilitar o mesmo digest para conversas via MCP fora do chat (sem snapshot): fora do escopo desta change; os tools existentes continuam disponíveis.
