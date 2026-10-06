Board ref: 5a92afc0-d02d-4dbe-9852-b931cb81ecb2

## Why

A revisão de 2026-10-05 identifica que `apps/api/src/services/assistantTools.ts` ainda reexporta execução de `apps/mcp/src/registry.ts`. Essa dependência de um aplicativo de transporte impede uma fronteira verificável e deixa autorização e unidade transacional escondidas em handlers extensos.

## What Changes

- Extrair execução, normalização e sanitização para uma camada compartilhada independente de MCP; preservar o catálogo puro de `packages/tool-registry`.
- Extrair casos de uso de criar, editar e mover item, batch e execução de ferramenta do agente, com identidade confiável, autorização explícita e ports transacionais.
- Fazer REST, agente e adaptador MCP convergirem para a mesma aplicação sem regras de negócio duplicadas e sem ciclo de imports.
- Verificar build/boot da API sem fontes MCP e paridade de resultados, erros e efeitos em SIMPLE/ADVANCED.
- Consumir os contratos de persistência de T36, fencing de T37 e unidade transacional de T38; não recriar adapters, worker, idempotência ou outbox. T39 continua responsável pela distribuição dos eventos.

## Capabilities

### New Capabilities
- `transport-independent-tool-execution`: execução independente de transporte e casos de uso críticos compartilhados com autorização e transação explícitas.

### Modified Capabilities
Nenhuma: os contratos públicos atuais e o registry puro são preservados; a nova capacidade especifica a fronteira residual ainda não garantida.

## Impact

Afeta `apps/mcp/src/registry.ts`, `apps/mcp/src/tools.ts`, `apps/api/src/services/assistantTools.ts`, `apps/api/src/routes/{items,batch,assistant,projects}.ts`, serviços do harness/worker e `apps/api/src/persistence`. Recomenda-se novo `packages/tool-execution` e camada `apps/api/src/application` (paths propostos), sem dependências de licença restritiva. Sem mudança intencional de rotas, payloads ou autenticação. Referências: `docs/ANALISE-SISTEMA-ATUALIZADA-2026-10-05.md`, specs `tool-registry-package`, `shared-package-architecture` e histórico `2026-10-05-agent-dashboard-metrics` (reuso das rotas, não recálculo no tool).
