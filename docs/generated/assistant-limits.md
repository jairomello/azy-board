<!-- GERADO AUTOMATICAMENTE por scripts/generate-docs.ts — não editar; rode `bun run generate:docs`. -->

# Limites do Azy Agent

Valores derivados de `packages/types/src/assistantLimits.ts` (fonte única consumida pela API, pelo web e por esta tabela).

## Governança padrão (por tenant)

| Limite | Valor padrão | Faixa permitida |
|---|---|---|
| `requestsPerMinute` | 10 | 1–1000 |
| `maxActivePerUser` | 1 | 1–20 |
| `maxActivePerTenant` | 3 | 1–100 |
| `dailyBudgetMicros` | 100000 | 1000–100000000 |
| `tenantDailyBudgetMicros` | 1000000 | 1000–1000000000 |
| `maxSteps` | 32 | 1–32 |
| `maxToolCalls` | 40 | 1–100 |
| `maxInputTokens` | 65000 | 1000–128000 |
| `maxOutputTokens` | 4000 | 256–32000 |
| `maxPayloadBytes` | 100000 | 1000–1000000 |
| `timeoutMs` | 90000 | 5000–300000 |

## Harness do agente

| Limite | Valor |
|---|---|
| `steps` | 16 |
| `toolCalls` | 40 |
| `inputTokens` | 16000 |
| `outputTokens` | 8000 |
| `payloadBytes` | 100000 |
| `timeoutMs` | 60000 |
| `costMicros` | 2000000 |

## Chat

| Limite | Valor |
|---|---|
| `MAX_MESSAGE_BYTES` | 30000 |
| `MAX_ASSISTANT_ACTIONS` | 40 |

## OpenAPI

O documento OpenAPI é gerado em `docs/generated/openapi.json` e também servido em runtime em `/openapi.json`.
