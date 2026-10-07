Board ref: 63658232-4112-47c3-937e-03bc6cb8fdcb

## Why

Criar hierarquia com `batch` e depois copiar checklists manualmente permite falhas parciais e políticas implícitas de dados. T28 oferece duplicação revisável de uma história ou subárvore como trabalho novo, sem replicar horas nem histórico.

## What Changes

- Preparar plano de cópia de estrutura, descrições e checklists com mapeamento de origem para novos IDs.
- Explicitar responsáveis, sprint, versão, links e anexos; reiniciar status, progresso, datas operacionais e passos marcados.
- Respeitar SIMPLE/HIERARCHICAL e validar destino, profundidade, limites e permissões antes da aprovação.
- Executar cópia atômica e idempotente de dados relacionais; retornar estrutura criada e exclusões de forma rastreável.

## Capabilities

### New Capabilities
- `work-structure-duplication`: plano e cópia segura de estruturas como modelo.

### Modified Capabilities
Nenhuma: complementa a criação em lote e preserva os contratos de hierarquia e anexos.

## Impact

- Evidências: `apps/api/src/db/sqlite/itemUnitOfWork.ts` (`createItemsBatch`), `apps/api/src/persistence/ports.ts`, `apps/api/src/db/postgres/adapter.ts`, `apps/api/src/routes/items.ts`, `packages/tool-registry/src/fields.ts` (batch e checklists).
- Referências: `openspec/specs/task-hierarchy/spec.md`, `sprint-management/spec.md`, `file-attachments/spec.md`; histórico `d884cc1` aplica defaults automáticos de sprint/versão em criações, que a cópia deve substituir explicitamente; oportunidade 12 do documento de sugestões.
- Decisão recomendada: cópia somente no mesmo projeto, anexos excluídos nesta entrega, links opcionais e dados relacionais em um commit; não orquestrar dezenas de chamadas de criação independentes.
- Dependência T38 (idempotência/outbox) para persistir chave/hash/resultado no commit e publicar efeitos; reutilizar sua infraestrutura. Templates persistidos e cópia física de anexos são evolução separada.
