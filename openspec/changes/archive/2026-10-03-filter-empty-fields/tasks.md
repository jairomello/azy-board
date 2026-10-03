## 1. Estado de filtros e constantes

- [x] 1.1 Adicionar `EMPTY_FILTER_VALUE = '__empty__'` e o helper `isEmptyFilterValue(value)` em `apps/web/src/features/board/model/types.ts`, mantendo `DEFAULT_FILTERS` com escalares em `''`
- [x] 1.2 Garantir que nenhum valor de catálogo (UUID) possa colidir com o sentinela (comparação exata pelo helper)

## 2. Internacionalização

- [x] 2.1 Adicionar as chaves `noAuthor` ("Sem autor") e `noCostCenter` ("Sem centro de custo") em `apps/web/src/i18n/locales/pt-BR/board.json`
- [x] 2.2 Replicar as chaves em `apps/web/src/i18n/locales/en/board.json` e `apps/web/src/i18n/locales/es/board.json`
- [x] 2.3 Confirmar reuso de `noSprint`, `noVersion`, `unassigned` e do rótulo neutro `allSprints` para o estado "sem filtro" de Sprint

## 3. Painel de Filtros (UI)

- [x] 3.1 Em `apps/web/src/components/BoardFilters.tsx`, trocar a opção neutra do filtro de Sprint para `value=""` com rótulo `allSprints` e adicionar `<option value={EMPTY_FILTER_VALUE}>{t('noSprint')}</option>`
- [x] 3.2 Adicionar opção de valor vazio ao filtro de Versão (`noVersion`), mantendo a opção neutra com rótulo do campo
- [x] 3.3 Adicionar opção de valor vazio ao filtro de Responsável (`unassigned`)
- [x] 3.4 Adicionar opção de valor vazio ao filtro de Autor (`noAuthor`)
- [x] 3.5 Adicionar opção de valor vazio ao filtro de Centro de Custo (`noCostCenter`)
- [x] 3.6 Confirmar que `activeCount` conta o sentinela como filtro ativo e que `clear()` restaura todos os campos para `''`
- [x] 3.7 Confirmar que o painel `Opções` (que compartilha `BoardFilters`) não é afetado

## 4. Aplicação do filtro client-side

- [x] 4.1 Em `apps/web/src/features/board/BoardScreen.tsx`, extrair predicados nomeados para valor vazio: sprint (`!item.itemSprints?.length`), versão (`!versionId`), responsável (`!assigneeId`), autor (`!authorId`) e centro de custo (`!costCenterId`)
- [x] 4.2 Aplicar os predicados no memo `boardCards` quando o valor do filtro é `EMPTY_FILTER_VALUE`, sem alterar o comportamento dos valores exatos e do estado neutro
- [x] 4.3 Aplicar os mesmos predicados no bloco de histórias folha duplicado
- [x] 4.4 Ajustar a invalidação de referências de catálogo (versão, sprint e centro de custo) para ignorar `EMPTY_FILTER_VALUE`

## 5. Chips de filtros ativos

- [x] 5.1 Em `apps/web/src/components/ActiveFilterChips.tsx`, emitir chip para valor `EMPTY_FILTER_VALUE` com o rótulo de estado vazio do campo
- [x] 5.2 Confirmar que `removeActiveBoardFilter` restaura o campo para `''` e mantém os demais filtros
- [x] 5.3 Confirmar que o estado neutro não gera chip

## 6. Persistência

- [x] 6.1 Confirmar que `apps/web/src/features/board/hooks/useBoardPreferences.ts` persiste e restaura o sentinela sem migração (estado passado `''` continua "sem filtro")
- [x] 6.2 Garantir que a migração/validação de estado não descarte o sentinela como valor inválido

## 7. Testes

- [x] 7.1 Adicionar testes de predicado client-side cobrindo cada campo no estado vazio e o estado neutro
- [x] 7.2 Adicionar/ajustar testes de `ActiveFilterChips` para chip e remoção de valor vazio
- [x] 7.3 Adicionar teste de persistência/restauração do sentinela e da invalidação de catálogo
- [x] 7.4 Atualizar os testes estruturais de UI (`ui-mode-contract.test.ts`) para as novas opções de valor vazio
- [x] 7.5 Executar `bun test --isolate apps/web/src` e garantir a suíte verde

## 8. Validação final e encerramento

- [x] 8.1 Mover o card T13 (`c6c6f1bb-85dc-41ca-a27f-ffe434a551bf`) para `Fazendo` e registrar o claim conforme o fluxo do Azy Board
- [x] 8.2 Executar `bun run check` (typecheck + lint + testes + build)
- [x] 8.3 Executar `bun run test:smoke` para validar o fluxo web/API
- [x] 8.4 Registrar `create_item_log` no card com o resumo da implementação
- [x] 8.5 Executar `complete_task` e confirmar no board real que o card está em coluna com `baseStatus=DONE`
