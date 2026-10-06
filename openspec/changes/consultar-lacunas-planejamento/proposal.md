Board ref: 5f3152ad-3d27-4a12-8c49-db79d0f631e2

## Why

A consulta atual não expressa ausência de prazo, pontos, sprint, versão e responsável em combinações abrangentes. T26 permite encontrar e contar lacunas reais e abrir o mesmo recorte no board sem inventar estimativas ou ampliar uma correção aprovada.

## What Changes

- Adicionar consulta somente-leitura paginada com condições tipadas ALL/ANY, ausência `IS_EMPTY`, igualdade e comparação de datas.
- Retornar total distinto, grupos por lacuna, interseções e referência de resultado consistente para paginação e abertura no board.
- Abrir o conjunto exato na aba de origem, inclusive condições que o toolbar atual não representa.
- Propor correções apenas com valores explicitamente informados e aprovação por grupo de IDs fixos; revalidar concorrência.

## Capabilities

### New Capabilities
- `planning-gap-query`: consulta, agrupamento, abertura e correção delimitada de lacunas.

### Modified Capabilities
Nenhuma: a nova consulta complementa `list_tasks` e reutiliza os comandos de interface existentes sem alterar seus requisitos.

## Impact

- Evidências: `packages/tool-registry/src/registry.ts` (`itemFiltersSchema`), `fields.ts` (`list_tasks`), `apps/api/src/routes/items.ts`, `packages/ui-contracts/src/visibility.ts` (`IS_EMPTY` traduzido para ausência em vínculos de sprint).
- `apps/api/src/services/assistantUiTools.ts` cobre sprint/versão/responsável, mas não prazo/pontos nem OR; integrar contratos em `packages/assistant-contracts` e apresentação em `apps/web/src/features/board/BoardScreen.tsx`.
- Referências: `openspec/specs/agent-ui-commands/spec.md`, `task-hierarchy/spec.md`, histórico `34651d0` (T17) e `5bb5967` (T18), oportunidade 10 do documento de sugestões.
- Decisão recomendada: consulta dedicada com resultado fixado, em vez de inferir totais de uma página de `list_tasks`; pontos zero são valor, não lacuna.
- Dependências: comandos de UI/contexto já entregues (T17/T18); T38 para garantir efeitos idempotentes/outbox de correções, não para executar leitura. Nenhuma infraestrutura de execução será duplicada.
