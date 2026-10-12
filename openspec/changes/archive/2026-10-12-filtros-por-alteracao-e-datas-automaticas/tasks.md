# Tasks

Board ref (registrar nos artefatos): T57 `045736de-b489-4af1-ab11-ac94bba9106b` · T58 `849fe963-f5e4-4338-8ea1-0cf5541d255c`

## 1. Marcador de última alteração (item-change-tracking)

- [x] 1.1 Criar o helper `touchItemAndAncestors(context, projectId, itemId)` nos adapters de persistência (SQLite e paridade PostgreSQL): ler `ancestry_path`, montar `[itemId, ...ancestrais]` e emitir **um** `UPDATE items SET updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id IN (...)`. Adicionar comentário `// [TENANT]` no ponto de resolução do tenant. Verificar com teste unitário que uma folha atualiza a própria task, a story e o épico em uma única sentença.
- [x] 1.2 Invocar o helper em todas as mutações de dependentes nos dois adapters — checklists/checklist_items, item_links, attachments, item_dependencies e item_logs (criar/editar/remover). Verificar com teste que cada tipo de dependente altera o `updated_at` do card dono.
- [x] 1.3 Cobrir subtasks: criar, alterar, mover e remover item filho propaga o marcador ao dono e aos ancestrais, na mesma transação. Verificar com teste de integração.
- [x] 1.4 Adicionar o índice `(tenant_id, project_id, updated_at)` em `apps/api/src/db/migrations` (SQLite) e na migration de paridade PostgreSQL, sem remover constraints. Verificar com o teste de migrations e `PRAGMA foreign_key_check`.
- [x] 1.5 Garantir isolamento: a propagação não toca itens de outro tenant/projeto. Adicionar `// [TENANT]` onde aplicável e verificar com teste negativo (item de outro projeto não é alterado).

## 2. Filtro de última alteração na API, MCP e agente

- [x] 2.1 Criar o mapa de janelas compartilhado (`1d`, `2d`, `3d`, `5d`, `1w`, `1m`, `current-sprint`) e uma função pura que calcula o início da janela em `America/Sao_Paulo` a partir de um instante de referência. Verificar com teste unitário dos limites (00:00 de ontem, N dias atrás, semana, mês) e do valor `current-sprint`.
- [x] 2.2 Aceitar `updatedWithin` em `GET /projects/:id/items` (parse + `apps/api/src/validation.ts`) e filtrar por `updatedAt >= início`, combinando com os demais filtros por AND. Verificar com teste de integração incluindo valor inválido (erro acionável).
- [x] 2.3 Declarar o campo em `list_tasks` no `packages/tool-registry` (fields, schema do enum e descrição) e mapear em `packages/tool-execution` (`http-adapter.ts`/`registry.ts`). Verificar com `bun test packages/tool-registry` e `bun run test:mcp-catalog` (paridade schema/validação/dispatcher).
- [x] 2.4 Atualizar a documentação gerada do MCP e referências da skill afetadas (`apps/mcp/README.md`, `skills/azyboard/`) com o novo filtro. Verificar com `bun run test:mcp-catalog` e, se `skills/azyboard/` mudar, `bun run test:agent-skill`.

## 3. Filtro de última alteração no board (UI)

- [x] 3.1 Adicionar a dimensão "Alterados" em `BoardFilterState`/`BoardFilters.tsx` e no default em `features/board/model/types.ts`. Verificar com `apps/web/src/components/board-filters.test.tsx` (opção presente e selecionável).
- [x] 3.2 Aplicar o filtro em `features/board/model/boardView.ts` combinado por AND com os demais, incluindo o preset "sprint atual" (sprint `OPEN` vigente). Verificar com teste de unidade do model.
- [x] 3.3 Exibir chip removível em `ActiveFilterChips.tsx` com o rótulo da janela e remoção individual. Verificar com `apps/web/src/components/active-filter-chips.test.tsx`.
- [x] 3.4 Persistir/restaurar o novo filtro por projeto em `useBoardPreferences` (com defaults para estados antigos) e respeitar a camada de sessão. Verificar com `useBoardPreferences.test.ts`.
- [x] 3.5 Adicionar traduções PT-BR/EN/ES em `apps/web/src/i18n/locales/*/board.json`. Verificar com o teste de validação de i18n.

## 4. Datas automáticas pela sprint (T58)

- [x] 4.1 Em `apps/api/src/application/items.ts`, preencher `startDate`/`dueDate` com as datas da sprint efetiva quando ausentes (preenchendo apenas o campo ausente), sem sobrescrever valor informado. Verificar com teste de integração API e via MCP.
- [x] 4.2 Aplicar a mesma regra no caminho de lote (`routes/batch.ts` e `routes/structureDuplication.ts`, conforme o caminho de criação). Verificar com teste de criação em lote.
- [x] 4.3 Nos formulários de criação (`AddCardForm.tsx` e `ItemModal.tsx`), pré-preencher as datas ao selecionar a sprint, mantendo editáveis, atualizando na troca de sprint e limpando sugestões não digitadas ao voltar ao estado neutro. Verificar com teste de componente.
- [x] 4.4 Garantir que alterar a sprint de um item existente não recalcula datas. Verificar com teste de edição.

## 5. Verificação final

- [x] 5.1 Executar `bun run check` (typecheck + lint + testes + build) e corrigir falhas.
- [x] 5.2 Executar `bun run test:smoke` para o fluxo web/API.
- [x] 5.3 Executar `bun run test:mcp-catalog` e `bun run test:agent-skill` (se a skill mudou) e confirmar paridade SQLite/PostgreSQL nos testes de banco.

## Workflow follow-up

- Registrar `Board ref: 045736de-b489-4af1-ab11-ac94bba9106b` (T57) e `Board ref: 849fe963-f5e4-4338-8ea1-0cf5541d255c` (T58) nos artefatos da change.
- Ao concluir a implementação, fechar **ambos** os cards com `complete_task` e confirmar no board real que o `status` é `DONE` (encerrar a change não encerra os cards).
- Arquivar a change após os requisitos de revisão do projeto.
