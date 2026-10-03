## 1. Utilitário de rascunho

- [x] 1.1 Criar `apps/web/src/lib/itemDraft.ts` com o tipo `ItemDraft` (`value`, `base`, `updatedAt`) e a função `itemDraftKey(projectId, itemId)` no formato `item-draft:<projectId>:<itemId>:description`
- [x] 1.2 Implementar `readItemDraft(projectId, itemId): ItemDraft | null` com `try/catch`, guarda de `JSON.parse` e validação do campo `value`
- [x] 1.3 Implementar `writeItemDraft(projectId, itemId, value, base)` gravando o JSON com `updatedAt` ISO e engolindo `SecurityError`/`QuotaExceededError` sem lançar
- [x] 1.4 Implementar `clearItemDraft(projectId, itemId)` e `clearAllItemDrafts()` (varredura das chaves com prefixo `item-draft:`) com `try/catch`
- [x] 1.5 Garantir que o utilitário não dependa de React nem do DOM além do `localStorage` e exporte apenas funções puras testáveis

## 2. Internacionalização

- [x] 2.1 Adicionar as chaves do aviso de rascunho (`draftRecovered`, `draftDiscard`) em `apps/web/src/i18n/locales/pt-BR/common.json` (ou `board.json`, conforme namespace usado pela `ItemModal`)
- [x] 2.2 Replicar as chaves em `apps/web/src/i18n/locales/en/` e `apps/web/src/i18n/locales/es/`
- [x] 2.3 Confirmar paridade com `bun run check:i18n`

## 3. Integração na ItemModal

- [x] 3.1 Em `apps/web/src/components/ItemModal.tsx`, adicionar estado do aviso de rascunho recuperado (ex.: `recoveredDraft`) e uma ref de hidratação `draftHydratedRef`
- [x] 3.2 No efeito de sincronização por `item.id` (L249-271), ler o rascunho: aplicar restauração, descarte silencioso quando igual ao servidor e marcar a hidratação
- [x] 3.3 Adicionar `useEffect` com debounce trailing de 800 ms sobre `description` que grava o rascunho via `writeItemDraft`, ignorando a primeira execução (hidratação) e o modo `__new__`
- [x] 3.4 Renderizar o banner não bloqueante de rascunho recuperado acima do `RichTextEditor` da área Detalhes, com botão de descartar que chama `clearItemDraft` e restaura `item.description`
- [x] 3.5 Em `handleSave` (L315-342), chamar `clearItemDraft` imediatamente após `await onSave(...)` resolver, antes de `onClose()`; garantir que o `catch` não limpe o rascunho
- [x] 3.6 Garantir que a limpeza do debounce ocorra no unmount e na troca de item para não gravar rascunho no item errado

## 4. Expurgo no logout

- [x] 4.1 Em `apps/web/src/contexts/AuthContext.tsx` (fluxo de logout), chamar `clearAllItemDrafts()` para remover as chaves `item-draft:` do usuário
- [x] 4.2 Confirmar que o expurgo não afeta outras preferências persistidas (`theme`, `language`, filtros do board)

## 5. Testes

- [x] 5.1 Adicionar testes unitários de `apps/web/src/lib/itemDraft.ts` cobrindo gravação, leitura, remoção, JSON inválido e `localStorage` indisponível (mock lançando `SecurityError`)
- [x] 5.2 Adicionar testes de componente (`apps/web/src/components/item-description-draft.test.tsx`, no padrão `*.test.tsx` + `test/setup.ts`) cobrindo restauração com aviso, descarte manual e limpeza após salvar
- [x] 5.3 Cobrir a preservação do rascunho quando o salvamento falha/rejeita
- [x] 5.4 Executar `bun test --isolate apps/web/src` e garantir a suíte verde

## 6. Validação final e encerramento

- [x] 6.1 Mover o card T15 (`37b047fe-f33a-4bf2-a618-8de297f2857f`) para `Fazendo` e registrar o claim conforme o fluxo do Azy Board
- [x] 6.2 Executar `bun run check` (typecheck + lint + testes + build)
- [x] 6.3 Executar `bun run test:smoke` para validar o fluxo web/API
- [x] 6.4 Registrar `create_item_log` no card com o resumo da implementação
- [x] 6.5 Executar `complete_task` e confirmar no board real que o card está em coluna com `baseStatus=DONE`
