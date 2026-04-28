## 1. Backend — Endpoint de exclusão em cascata

- [x] 1.1 Criar endpoint `DELETE /api/items/:id` no router de items do Hono, com middleware de autenticação e RBAC (rejeitar VIEWER com 403)
- [x] 1.2 Implementar função `deleteItemCascade(tenantId, itemId)` usando CTE recursiva (`WITH RECURSIVE`) para coletar todos os descendentes do item // [TENANT] filtragem obrigatória por tenantId em cada nível da CTE
- [x] 1.3 Dentro da mesma transação, excluir checklist-items, checklists e items na ordem correta para evitar violação de FK // [DB-SWAP] no PostgreSQL, usar `ON DELETE CASCADE` no schema em vez de exclusão manual por CTE
- [x] 1.4 Retornar HTTP 200 com `{ deleted: number }` (contagem de registros removidos) em caso de sucesso; 404 se item não pertence ao tenant

## 2. Backend — `childrenCount` na listagem do board

- [x] 2.1 Adicionar subquery de `COUNT(*)` agrupada por `parentId` na query de listagem de itens do board para calcular `childrenCount` por item // [DB-SWAP] verificar sintaxe de subquery para PostgreSQL
- [x] 2.2 Incluir `childrenCount` no payload de resposta da API de listagem de itens

## 3. Tipos compartilhados

- [x] 3.1 Adicionar campo `childrenCount: number` na interface `CardData` em `packages/types/src/index.ts`

## 4. Frontend — Botão excluir no card

- [x] 4.1 Importar ícone `Trash2` do `lucide-react` no `KanbanCard.tsx`
- [x] 4.2 Adicionar o botão de exclusão no canto superior direito do card, visível apenas no hover (classe `opacity-0 group-hover:opacity-100`) e somente quando a prop `onDelete` for fornecida
- [x] 4.3 No clique do botão, exibir `window.confirm()` com a mensagem: "Excluir este item e todos os seus filhos (subtasks, checklists)? Esta ação é permanente."
- [x] 4.4 Se confirmado, chamar a prop `onDelete(card.id)`; se cancelado, não fazer nada
- [x] 4.5 Adicionar prop `onDelete?: (id: string) => void` na interface de props do `KanbanCard`
- [x] 4.6 No `BoardPage.tsx`, implementar `handleDeleteItem(id)` que chama o endpoint `DELETE /api/items/:id` e recarrega a listagem do board após sucesso
- [x] 4.7 Passar `onDelete={handleDeleteItem}` para cada `KanbanCard` renderizado no board (apenas para usuários ADMIN/MEMBER)

## 5. Frontend — Indicador de filhos no footer do card

- [x] 5.1 Importar ícone `GitBranch` do `lucide-react` no `KanbanCard.tsx`
- [x] 5.2 No footer do card, adicionar bloco condicional `{card.childrenCount > 0 && (...)}` com o ícone `GitBranch` (16px) e o número de filhos
- [x] 5.3 Envolver o indicador em um elemento com `title={\`${card.childrenCount} subtasks\`}` para o tooltip nativo

## 6. Frontend — Box informativa na modal de item bloqueado

- [x] 6.1 Importar ícone `Info` do `lucide-react` no `ItemModal.tsx`
- [x] 6.2 Logo abaixo do cabeçalho da modal, adicionar bloco condicional `{!item.isLeaf && (...)}` exibindo a info box com fundo `bg-blue-50 dark:bg-blue-950` e borda `border-blue-200 dark:border-blue-800`
- [x] 6.3 Inserir o texto: "Este card tem subtasks. Seu status no board é determinado pelo progresso dos seus filhos — por isso ele não pode ser arrastado manualmente. Para mover este card, mova ou conclua as subtasks."

## 7. Frontend — Ícones Lucide nos botões de ação

- [x] 7.1 No `BoardPage.tsx`, adicionar ícones `Layers` (Novo Épico), `BookOpen` (Nova História), `CheckSquare` (Nova Task), `Bug` (Novo Bug) e `Plus` nos botões da toolbar
- [x] 7.2 No `ItemModal.tsx`, adicionar ícone `Plus` no botão "+ Adicionar subtask" e ícone `Check` / `X` nos botões de salvar/cancelar
- [x] 7.3 No `AddCardForm.tsx`, adicionar ícone `Plus` no botão de confirmar criação e `X` no botão de cancelar
- [x] 7.4 Em qualquer outro botão de edição inline (ex: editar épico em BoardPage), adicionar `Pencil` como ícone

## 8. Frontend — Botões preenchidos com cores modernas

- [x] 8.1 No `BoardPage.tsx`, converter os botões da toolbar (Novo Épico, Nova História, Nova Task, Novo Bug) de outline para preenchidos: primário azul `bg-primary text-primary-foreground hover:bg-primary/90`, variante verde para Task, vermelho para Bug
- [x] 8.2 No `ItemModal.tsx`, converter botões de salvar para `bg-primary text-primary-foreground` e botões de cancelar para `bg-muted text-muted-foreground hover:bg-muted/80`
- [x] 8.3 No `AddCardForm.tsx`, converter botão de confirmar para `bg-primary text-primary-foreground` e cancelar para `bg-muted`
- [x] 8.4 Garantir que o botão excluir no card (task 4.2) use `bg-red-600 text-white hover:bg-red-700` ou `text-red-500 hover:text-red-700` conforme o contexto visual do card
