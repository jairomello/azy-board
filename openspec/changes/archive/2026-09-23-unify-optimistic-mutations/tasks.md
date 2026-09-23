## 1. API — item + tags atômico (`apps/api/src`)

- [x] 1.1 Adicionar `tagIds` opcional a `createItemSchema` e `updateItemSchema` em `validation.ts` (mantendo `.strict()`)
- [x] 1.2 Em `POST /projects/:projectId/items`, persistir item e vínculos de tags na mesma transação
- [x] 1.3 Em `PATCH /projects/:projectId/items/:itemId`, persistir campos, sprint e tags na mesma transação e emitir um único broadcast `ITEM_UPDATED` com as tags
- [x] 1.4 Garantir rollback total quando `tagIds` contiver tag inválida/fora do projeto (nenhuma alteração de campos confirmada)
- [x] 1.5 Rota `POST /:itemId/tags` mantida para compatibilidade (usada pelo MCP `set_item_tags`); web deixou de usá-la

## 2. API — conflito de edição

- [x] 2.1 Adicionar `expectedUpdatedAt` opcional a `updateItemSchema`
- [x] 2.2 Tornar o update condicional (`WHERE ... AND updated_at = expectedUpdatedAt`) quando informado
- [x] 2.3 Responder HTTP 409 com código `CONFLICT` quando a versão divergir, sem aplicar alteração
- [x] 2.4 Código `CONFLICT` já mapeado no contrato único de erro (`middleware/errorResponse.ts`)

## 3. Web — política única de mutação (`apps/web/src`)

- [x] 3.1 Criar helper puro `runOptimisticMutation` em `features/board/model/mutation.ts`
- [x] 3.2 Migrar `useBoardInteraction` para o helper, preservando snapshot + rollback + toast
- [x] 3.3 Corrigir `handleTitleSave` para reverter o título anterior em falha (rollback direcionado)
- [x] 3.4 Expor `updatedAt` em `features/board/model/types.ts` (`ItemData`)

## 4. Web — salvamento coordenado item + tags

- [x] 4.1 `ItemModal`/`BoardModals` já passavam `tagIds`; o handler agora envia campos e tags numa única chamada
- [x] 4.2 Ajustar `handleModalSave` para enviar `expectedUpdatedAt` e reconciliar o cache com a resposta
- [x] 4.3 Ajustar `handleModalCreate` para enviar `tagIds` na criação (sem segunda requisição)
- [x] 4.4 Tratar 409 `CONFLICT` reconciliando via `invalidateBoard()` e avisando o usuário
- [x] 4.5 `applyBoardEvent`/`ITEM_UPDATED` mescla `itemTags` quando presentes (coberto por teste)

## 5. Web — erros sempre visíveis

- [x] 5.1 Adicionar tratamento de erro (`mutationError`) ao CRUD e ao toggle de `ChecklistSection`
- [x] 5.2 Remover o `catch` silencioso de `StoriesPanel.handleDelete` e sinalizar o erro
- [x] 5.3 Padronizar aviso nas mutações do `BoardScreen` (criar item, tags, story, épico)
- [x] 5.4 Adicionar chaves i18n nos 3 idiomas (pt-BR, en, es)

## 6. Testes

- [x] 6.1 Testar `runOptimisticMutation` (sucesso, rollback direcionado, erro comunicado)
- [x] 6.2 Testar rollback de título (helper + contrato do handler)
- [x] 6.3 Testar salvamento item+tags: uma requisição, cache reconciliado (contrato + API)
- [x] 6.4 Testar conflito 409: reconciliação e aviso (contrato + API)
- [x] 6.5 Integração da API: `PATCH`/`POST` com `tagIds` atômico, tag inválida faz rollback, `expectedUpdatedAt` defasado retorna 409
- [x] 6.6 Contract tests: `ItemData` expõe `updatedAt`, board não faz duas chamadas, ITEM_UPDATED mescla tags

## 7. Verificação

- [x] 7.1 Rodar `bun run check` e corrigir o que aparecer
- [x] 7.2 Rodar `bun run test:regression --with-e2e` e confirmar a bateria verde
