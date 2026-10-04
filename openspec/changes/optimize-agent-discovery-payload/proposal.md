# Proposal — Otimização de desempenho do Azy Agent (payloads de descoberta)

## Why

Logs do labapps (2026-10-04) mostram o padrão dominante de lentidão/travamento: cada pergunta que exige descoberta do board custa **dois ou mais round-trips de inferência**, e a descoberta (`get_board`/`get_tree`) devolve **~120–156 KB** para 89 itens — o prompt do passo seguinte salta de ~3,6K para **~30K tokens**, o que (a) estoura o `timeoutMs` do tenant (run `ad06a96b`, `FAILED/TIMEOUT` em 68s), (b) dispara `PAYLOAD_LIMIT` quando o teto do tenant é menor (run `eb503a28`), e (c) paga o mesmo custo de descoberta repetidamente ao longo da conversa. O corte fixo de 32.000 chars (Card B7) evita a falha, mas desperdiça a maior parte do payload em metadados que a pergunta não pede. Ajustar só timeouts não resolve: o agente precisa responder perguntas de descoberta com **menos passos e menos tokens**, sem ficar "sem contexto".

## What Changes

- **Novo tool `get_screen_overview` (READ)**: digest de uma única chamada que responde perguntas de recorte/contagem ("quantos cards estão na tela na coluna backlog?") em ~1–3 KB — contagens por coluna/status/tipo, sprintAtiva, filtro aplicado e amostra de IDs — derivado do snapshot da tela (T16) quando existir, ou calculado do projeto quando não existe.
- **Modo `summary` default em `get_board`/`get_tree`**: por item, devolve por padrão só a projeção leve (`id`, `sequenceCode`, `title`, `type`, `status`, `columnId`, `priority`, `assigneeId`, `points`); campos pesados (`description`, `notes`, `persona`, `goal`, `benefit`, `acceptanceCriteria`, `scope`, metadados de turnaround) só entram com `includeDetails=true`, paginado quando o resultado primeira página exceder o teto do transcript (B7).
- **"Descoberta em um passo" no prompt do sistema**: instrução explicita para (1) preferir o snapshot da tela já capturado no contexto antes de chamar qualquer tool de descoberta; (2) agrupar leituras independentes em **múltiplos tool calls no mesmo passo** (o harness já suporta); (3) usar `get_screen_overview` para contagens/recortes e reservar `get_board` completo para quando o item é conhecido.
- **Reaproveitamento determinístico dentro da run**: leituras idênticas já são deduplicadas (`seen`); o digest carrega `contextId` do snapshot e é revalidado contra `capturedAt` para não servir contagem obsoleta quando o board mudou durante a conversa.

## Capabilities

### New Capabilities
- `agent-screen-overview`: digest de descoberta de um passo (contagens por coluna/status/tipo do recorte exibido, com revalidação por contextId/capturedAt).

### Modified Capabilities
- `adaptive-agent-tool-routing`: roteamento adaptativo passa a incluir `get_screen_overview` para intenções `read` sobre recortes de tela, e o modo `summary` default das descobertas muda o contrato de saída exigido pelo modelo.
- `ai-provider-configuration`: nada muda nos requisitos deste spec — mantido fora do escopo (latência de provider é de terceiros); apenas o tamanho do prompt por passo cai.

## Impact

- **API/harness**: `apps/mcp/src/tools.ts` (novo tool + modo summary), `apps/mcp/src/registry.ts` (chaveamento), `apps/api/src/services/assistantHarness.ts` (injection de contexto no tool e reuso do snapshot).
- **Prompt**: `AZY_AGENT_SYSTEM_PROMPT` em `apps/api/src/routes/assistant.ts` (instruções de descoberta em um passo).
- **Contratos**: `packages/assistant-contracts` (limites e tipos do digest); tabela gerada `docs/generated/assistant-limits.md`.
- **Frontend**: nenhum requisito novo; o drawer já consome tool events genericamente. `apps/web/src/assistant-ui-contract.test.ts` revalida os guardas existentes.
- **Custo por pergunta típica**: 2 steps / ~8K tokens no pior caso (hoje: 3–4 steps / ~30K tokens), sem risco de `TIMEOUT` em tenant com teto de 60s.
