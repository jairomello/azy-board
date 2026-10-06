Board ref: 4b20db3d-ddf2-400e-b0f4-cb3f1a4ac351

## Why

Listar cards, alterar sprint e fechar a atual separadamente não garante uma transição consistente ou retomável. T27 transforma essas primitivas em um plano revisável que preserva concluídos, vínculos anteriores e histórico analítico.

## What Changes

- Preparar plano com origem OPEN, destino PROPOSED ou OPEN explicitamente resolvido, folhas pendentes e impacto do fechamento.
- Acrescentar destino aos pendentes mantendo vínculo de origem e demais sprints; excluir DONE/CANCELLED e agregadores.
- Aplicar associações e fechamento em comando atômico, com revalidação de revisões e ciclo ativo.
- Registrar resultado idempotente e publicar efeitos pós-commit; retomar após falha sem repetir vínculos nem ciclos.

## Capabilities

### New Capabilities
- `reviewable-sprint-transition`: plano, aprovação, execução e recuperação da transição.

### Modified Capabilities
Nenhuma: preserva o ciclo de vida e a associação múltipla definidos em `sprint-management`.

## Impact

- Evidências: `apps/api/src/routes/sprints.ts`, `apps/api/src/services/sprints.ts`, `apps/api/src/db/sqlite/adapter.ts` (`transitionSprint` materializa ciclos), `apps/api/src/db/postgres/adapter.ts`, `apps/api/src/db/sqlite/itemUnitOfWork.ts` (`replaceRelations` substitui vínculos).
- Estender comandos tipados em `apps/api/src/persistence/ports.ts`, integrar catálogo compartilhado/MCP e harness de aprovação.
- Referências: `openspec/specs/sprint-management/spec.md`, `apps/api/src/sprint-filter.test.ts` (múltiplos vínculos), `apps/api/src/integration.test.ts` (ciclos); oportunidade 11 do documento de sugestões.
- Decisão recomendada: carry-over adiciona vínculo, não usa `SET sprint`; fechar a atual não ativa o destino implicitamente. A baseline anterior permanece imutável.
- Dependência T38 (idempotência/outbox) para reservar operação, persistir resultado no mesmo commit e retomar notificações; implementar somente o comando de domínio de transição, sem outro executor/outbox.
