# Tasks

## 1. Progresso sem checklist

- [x] 1.1 Remover o checklist de `computeAdvance`/`createAdvanceResolver` e de `AdvanceItem` em `packages/domain/src/progress.ts`, verificando que `bun test packages/domain/src/progress.test.ts` cobre coluna, status, `DONE` fora da coluna, cancelado e agrupador sem checklist.
- [x] 1.2 Atualizar os chamadores que hoje passam checklist (`apps/web/src/features/board/model/cardAdvance.ts`, `BoardScreen.tsx`, `BoardLanes.tsx` e `apps/api/src/services/treeProgress.ts`) e verificar com `bun run typecheck`.
- [x] 1.3 Ajustar os testes de progresso do domínio, da API (`apps/api/src/services/treeProgress.test.ts`) e do board para o novo percentual e verificar que a suíte desses arquivos passa.

## 2. Barra de checklist

- [x] 2.1 Adicionar o tom `checklist` ao `ProgressBar` e as classes/tokens correspondentes em `globals.css`, verificando em `apps/web/src/components/progress-bar.test.tsx` que o tom muda o estilo e mantém acessibilidade, `data-progress-tone` e transição reduzida.
- [x] 2.2 Renderizar a barra de checklist no `KanbanCard` junto do contador `marcados/total`, verificando com teste de componente os casos com um checklist, vários checklists, checklist vazio e checklist 100% (sem herdar o verde de conclusão da barra principal).
- [x] 2.3 Criar as chaves de i18n do checklist em pt-BR, en e es e verificar com `bun run check:i18n`.

## 3. Barra de subtasks

- [x] 3.1 Criar `subtasksProgressByParent` no model do board, com média de avanço dos filhos diretos válidos e normalização de `story-virtual-`, verificando com teste unitário média, exclusão de cancelados/arquivados, ausência de filhos e card virtual.
- [x] 3.2 Propagar `subtasksProgress` até o `KanbanCard` nas visões que renderizam cards e verificar com teste que a barra aparece apenas com filhos válidos e mostra percentual e contagem coerentes.
- [x] 3.3 Criar as chaves de i18n das subtasks em pt-BR, en e es e verificar com `bun run check:i18n`.

## 4. Composição das três barras

- [x] 4.1 Garantir no `KanbanCard` a ordem progresso → checklist → subtasks e a omissão sem espaço reservado, verificando com teste os cenários de zero, uma, duas e três barras, inclusive avanço zero com checklist.
- [x] 4.2 Garantir nomes acessíveis distintos nas três barras e verificar no teste de componente que cada `progressbar` tem rótulo próprio.
- [x] 4.3 Confirmar atualização em tempo real do checklist e dos status das subtasks sem recarregar, verificando no teste de cache/real-time existente ou em novo teste do model que o card recalcula as barras.
- [x] 4.4 Conferir o resultado visual contra `mockups/card-progresso-tres-barras.svg` nos temas claro e escuro e nas densidades confortável e compacta, registrando a conferência na descrição da entrega.

## 5. Verificação e documentação

- [x] 5.1 Rodar `bun run check` e `bun run test:smoke`, registrando qualquer falha ambiental (por exemplo, PostgreSQL local) separadamente de regressão da change.
- [x] 5.2 Validar `bun run openspec:validate` e `bun run check:docs`.
- [x] 5.3 Atualizar `CHANGELOG.md` com a mudança de comportamento do progresso e as novas barras, verificando com `bun run check:docs`.

## Workflow follow-up

- Arquivar a change após o merge e a validação dos artefatos.
