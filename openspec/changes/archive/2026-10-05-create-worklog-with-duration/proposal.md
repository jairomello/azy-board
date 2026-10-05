## Why

O Azy Board já registra trabalho com duração no painel Diário e o executor MCP (`toolCreateItemLog`) repassa `durationMin` à API — mas o contrato de criação exposto ao agente não declara o campo: `toolFields.create_item_log` só aceita `projectId`, `itemId` e `activity`. Uma chamada de criação com duração é rejeitada por campo desconhecido, então o agente precisa criar o apontamento e depois editá-lo — duas operações e dois previews para um único ato. O card **T21 — Criar apontamentos de trabalho com duração** fecha essa lacuna na mesma trilha do doc `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md` (oportunidade 5: “Registrar tempo de trabalho em uma única operação”).

**Board ref:** `1fe2e457-e2f5-4acb-9856-cd018e740d1a` (T21 - Criar apontamentos de trabalho com duração, coluna "Backlog").

## What Changes

- **Contrato de criação com duração**: `create_item_log` passa a aceitar `durationMin` (inteiro de minutos, opcional) além de `projectId`, `itemId` e `activity`, tanto no MCP quanto no harness do Azy Agent, a partir do descritor único em `packages/tool-registry`.
- **Duração legível normalizada**: aceitar entrada humano-legível (`1h30`, `1h`, `90min`, `1:30`) em um campo opcional `duration`, normalizada para minutos antes da validação/execução. `durationMin` (número) é a forma canônica; quando ambos vierem e divergirem, a validação rejeita de forma acionável.
- **Validação de duração**: duração não-negativa e inteira, com rejeição acionável citando o formato aceito e o valor recebido; o limite de `activity` continua o do catálogo.
- **Prévia de aprovação explicativa**: a prévia de `create_item_log` (e de `update_item_log`) mostra a atividade e a duração formatada (`90 min` / `1h30`), não o JSON cru.
- **Sem duplicação por repetição**: apontamento repetido pelo agente na mesma run não cria registro novo (dedup por assinatura de mutação já existente no harness), coberto por teste.
- **Data retroativa fora de escopo**: o domínio/API não suportam data escolhida no apontamento; a mudança NÃO promete isso e registra a limitação.
- **Skill e documentação**: a skill oficial documenta a criação de apontamento com duração e o formato humano aceito.
- **Sem BREAKING**: o campo é aditivo e opcional; criação sem duração continua idêntica.

**Fora de escopo:** CRUD de links/anexos, data retroativa de apontamento, e demais oportunidades do doc (foco de UI, métricas, squad, etc.).

## Capabilities

### New Capabilities

<!-- Nenhuma nova capability: a mudança completa contratos existentes. -->

### Modified Capabilities

- `mcp-tool-registry`: o descritor de `create_item_log` passa a declarar `durationMin`/`duration` e a normalização de duração legível; validação, coerção e testes de paridade/opcional refletem o novo campo.
- `mcp-server`: a ferramenta `create_item_log` aceita e normaliza duração, retorna o apontamento criado com duração e deixa explícita a ausência de suporte a data retroativa.
- `azy-agent-harness`: a prévia de aprovação de apontamentos exibe atividade e duração formatada; a repetição do mesmo apontamento não duplica o registro.
- `official-agent-skill`: a skill documenta a criação de apontamento com duração em minutos e em formato humano.

## Impact

- **Catálogo compartilhado**: `packages/tool-registry/src/fields.ts` (`create_item_log`), `registry.ts` (descrição, schema de `durationMin`/`duration`, uso no `schemaFor`), `validation.ts` (validação/parse de duração) e um parser de duração reutilizável em `packages/ui-contracts`/`packages/tool-registry`.
- **MCP**: `apps/mcp/src/tools.ts` (`toolCreateItemLog` normaliza e envia `durationMin`) e `apps/mcp/src/registry.ts` (dispatch); README gerado (`apps/mcp/README.md`).
- **API**: `apps/api/src/routes/items.ts` (`POST .../logs` já aceita `durationMin`; conferir retorno da duração) e `apps/api/src/validation.ts` (`itemLogSchema`).
- **Harness do agente**: `apps/api/src/services/assistantHarness.ts` (`approvalPreview`/`canonicalArguments` com ramo para apontamentos) e testes de dedup.
- **Skill**: `skills/azyboard/SKILL.md`, `skills/azyboard/references/mcp-operations.md` e espelho `.opencode/skills/azyboard/`.
- **Testes**: `packages/tool-registry/src/registry-contract.test.ts`, `apps/mcp/src/optional-fields.test.ts`, `apps/api/src/services/assistantHarness.test.ts` e `bun run test:agent-skill`; verificação final com `bun run check` e `bun run test:smoke`.
