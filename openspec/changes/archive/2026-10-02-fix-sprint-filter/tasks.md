## 1. Correção da API (backend)

- [x] 1.1 Remover `delete flat.itemSprints` da projeção de resposta em `apps/api/src/routes/items.ts` (linha ~367), mantendo o array `itemSprints` no objeto projetado
- [x] 1.2 Verificar que `sprintId` achatado continua presente na resposta para compatibilidade

## 2. Verificação do filtro client-side (frontend)

- [x] 2.1 Confirmar que o filtro em `apps/web/src/features/board/BoardScreen.tsx` (linha ~251) usa `i.itemSprints?.some(...)` e que agora funciona com o campo presente
- [x] 2.2 Confirmar que o filtro para histórias folha (linha ~287) também funciona
- [x] 2.3 Confirmar que o indicador de progresso da sprint ativa (linha ~874) funciona

## 3. Testes de regressão

- [x] 3.1 Adicionar ou ajustar teste de API que valide a presença de `itemSprints` na resposta do `GET /projects/:projectId/items`
- [x] 3.2 Adicionar ou ajustar teste que valide o filtro por sprint (item com sprint aparece; item sem sprint não aparece)

## 4. Validação final

- [x] 4.1 Executar `bun run check` (typecheck + lint + testes + build)
- [x] 4.2 Executar `bun run test:smoke` para validar o fluxo web/API
- [x] 4.3 Registrar log de conclusão no card B2 (`06ac8ce7-1e3e-4aaf-be18-46b2189cad3a`)