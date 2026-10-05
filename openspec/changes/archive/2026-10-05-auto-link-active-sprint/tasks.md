## 1. Política determinística de defaults

- [x] 1.1 Adicionar helper de **sprint vigente**: `status = OPEN` e `startDate <= hoje <= endDate` (hoje em UTC/YYYY-MM-DD); empate → menor `createdAt`, com `// [TENANT]`
- [x] 1.2 Adicionar helper de **versão vigente**: `status != CANCELLED`, `releaseDate != null` e `releaseDate >= hoje`; menor `releaseDate`; empate → menor `createdAt`
- [x] 1.3 Centralizar a decisão: aplicar defaults (sprint, versão, ícone `DEFAULT_ITEM_ICON`) apenas quando o campo for **omitido** e o tipo for TASK/BUG
- [x] 1.4 Definir "hoje" de forma determinística (data em UTC) reutilizada pelos dois helpers

## 2. Criação individual (`POST /projects/:id/items`)

- [x] 2.1 Em `apps/api/src/routes/items.ts`, quando `sprintId === undefined` e tipo TASK/BUG, resolver a sprint vigente e usá-la em `sprintIds` (sem alterar a validação de sprint explícita)
- [x] 2.2 Quando `versionId === undefined` e tipo TASK/BUG, resolver a versão vigente e persistir `versionId`
- [x] 2.3 Quando `icon === undefined` e tipo TASK/BUG, persistir `DEFAULT_ITEM_ICON`
- [x] 2.4 Garantir precedência: ID explícito e `null` vencem o automático em todos os três campos
- [x] 2.5 Confirmar que a resposta (`loadItemWithRelations`) e o broadcast incluem sprint, versão e ícone aplicados

## 3. Criação em lote (`POST /projects/:id/batch`)

- [x] 3.1 Na rota de lote, resolver sprint/versão vigentes uma vez e injetar defaults nas operações `create_task` de TASK/BUG que omitirem os campos; respeitar valores explícitos (inclusive `null`/`[]`)
- [x] 3.2 Em `apps/api/src/db/sqlite/itemUnitOfWork.ts`, fazer `createBatchItemInsideTransaction` gravar `item_sprints`, `version_id` e `icon` a partir da operação, de forma idempotente
- [x] 3.3 Manter a unicidade `(itemId, sprintId)` e registrar que o lote permanece SIMPLE (paridade PostgreSQL de `createItemsBatch` segue pendente, como em B4)

## 4. Documentação para agentes

- [x] 4.1 Atualizar as descrições de `create_task` e `batch` em `packages/tool-registry/src/registry.ts` explicando os defaults (sprint/versão vigentes, ícone default) e o escape hatch (`sprintId: null`, `versionId: null`, `icon: null`)

## 5. Testes

- [x] 5.1 Criação individual — sprint: com sprint vigente (vincula), sprint OPEN fora das datas (não vincula), sem candidata (não vincula), `sprintId` explícito e `sprintId: null`
- [x] 5.2 Criação individual — versão: próxima `releaseDate` (vincula), sem data/cancelada (não vincula), empate → mais antiga, `versionId` explícito e `versionId: null`
- [x] 5.3 Criação individual — ícone: sem ícone persiste `file-text`; `icon` explícito e `icon: null` não recebem default
- [x] 5.4 Criação em lote: TASK/BUG recebem sprint/versão vigentes e ícone; valores explícitos não são sobrescritos; sem duplicidade em reexecução
- [x] 5.5 Confirmar que EPIC/STORY não recebem defaults automáticos

## 6. Verificação e encerramento

- [x] 6.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 6.2 Rodar `bun run test:smoke` (fluxo web/API)
- [x] 6.3 Registrar `Board ref: 300b8bf4-8e65-4f8a-ae5c-682f5c790430` nos artefatos da change e confirmar que o card T35 termina em coluna com `baseStatus = DONE` (`complete_task`)
