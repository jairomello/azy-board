## 1. Schema Drizzle — tabelas `checklists` e `checklist_items`

- [x] 1.1 Em `apps/api/src/db/schema.ts`, adicionar tabela `checklists`: colunas `id TEXT PK`, `tenantId TEXT NOT NULL`, `itemId TEXT NOT NULL REFERENCES items(id)`, `name TEXT NOT NULL`, `position INTEGER NOT NULL DEFAULT 0`, `createdAt TEXT NOT NULL` // [TENANT] tenantId obrigatório para isolamento cross-tenant
- [x] 1.2 Adicionar tabela `checklist_items`: colunas `id TEXT PK`, `tenantId TEXT NOT NULL`, `checklistId TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE`, `text TEXT NOT NULL`, `checked INTEGER NOT NULL DEFAULT 0` (SQLite boolean), `position INTEGER NOT NULL DEFAULT 0` // [DB-SWAP] Em PostgreSQL usar `BOOLEAN` em vez de `INTEGER` para `checked`
- [x] 1.3 Adicionar `checklistsRelations` (checklist → items) e `checklistItemsRelations` (item → checklist) em `schema.ts`
- [x] 1.4 Rodar `bun drizzle-kit push` para aplicar as tabelas no banco local

## 2. Backend — rotas de checklists

- [x] 2.1 Criar `apps/api/src/routes/checklists.ts` com router Hono; registrar todas as rotas com `authMiddleware` e `requireRole('MEMBER')` para escrita e `requireRole('VIEWER')` para leitura
- [x] 2.2 Implementar `GET /projects/:projectId/items/:itemId/checklists`: retorna checklists com seus itens ordenados por `position`; valida que o item pertence ao tenant // [TENANT] join com items para confirmar tenantId
- [x] 2.3 Implementar `POST /projects/:projectId/items/:itemId/checklists`: cria checklist com `name` e `position = max(position) + 1`; valida que o item existe e pertence ao tenant // [TENANT]
- [x] 2.4 Implementar `PATCH /projects/:projectId/items/:itemId/checklists/:checklistId`: permite atualizar `name` e/ou `position` do checklist // [TENANT]
- [x] 2.5 Implementar `DELETE /projects/:projectId/items/:itemId/checklists/:checklistId`: deleta checklist (cascade apaga itens); retorna `204` // [TENANT]
- [x] 2.6 Implementar `POST /projects/:projectId/items/:itemId/checklists/:checklistId/items`: cria item com `text` e `position = max + 1`, `checked = false`; emite WebSocket `CHECKLIST_UPDATED` // [TENANT]
- [x] 2.7 Implementar `PATCH /projects/:projectId/items/:itemId/checklists/:checklistId/items/:checklistItemId`: atualiza `text`, `checked` e/ou `position`; emite `CHECKLIST_UPDATED` // [TENANT]
- [x] 2.8 Implementar `DELETE /projects/:projectId/items/:itemId/checklists/:checklistId/items/:checklistItemId`: remove item; emite `CHECKLIST_UPDATED`; retorna `204` // [TENANT]
- [x] 2.9 Registrar o router de checklists no app principal (`apps/api/src/index.ts`) sob o prefixo `/projects/:projectId/items/:itemId/checklists`

## 3. Backend — progresso agregado no payload do board

- [x] 3.1 Em `apps/api/src/routes/items.ts`, no handler `GET /projects/:projectId/items`, adicionar subquery que calcula `checklistProgress: { checked, total }` para cada item via `GROUP BY checklistId JOIN checklist_items`; retornar `null` para items sem checklists // [DB-SWAP] subquery `GROUP BY` funciona igual em SQLite e PostgreSQL
- [x] 3.2 No handler `GET /projects/:projectId/items/:itemId` (detalhe do card), incluir os checklists completos com itens no payload de resposta

## 4. Backend — evento WebSocket

- [x] 4.1 Garantir que o evento `CHECKLIST_UPDATED` seja emitido com `{ type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, checklists } }` em todas as operações de escrita de checklists e itens

## 5. Tipos TypeScript compartilhados

- [x] 5.1 Em `packages/types/src/index.ts`, exportar interfaces `Checklist`, `ChecklistItem` e `ChecklistProgress`: `Checklist = { id: string; name: string; position: number; items: ChecklistItem[] }`, `ChecklistItem = { id: string; text: string; checked: boolean; position: number }`, `ChecklistProgress = { checked: number; total: number }`

## 6. Frontend — componente ChecklistSection

- [x] 6.1 Criar `apps/web/src/components/ChecklistSection.tsx`: recebe `itemId`, `projectId`, `initialChecklists`; gerencia estado local de checklists
- [x] 6.2 Implementar criação de checklist no `ChecklistSection`: input de nome + botão confirmação → `POST .../checklists`
- [x] 6.3 Implementar adição de item: campo de texto por checklist + Enter ou botão "+" → `POST .../items`
- [x] 6.4 Implementar toggle de item: click na checkbox → `PATCH .../items/:id` com `{ checked: !current }`; update otimista + rollback em erro
- [x] 6.5 Implementar exclusão de item: ícone de lixeira por item → `DELETE .../items/:id`
- [x] 6.6 Implementar exclusão de checklist: menu "..." → "Excluir checklist" → `DELETE .../checklists/:id`
- [x] 6.7 Adicionar barra de progresso por checklist: `<div>` com `width: (checked/total * 100)%` e texto `X/Y concluídos`; cor verde quando `X === Y`

## 7. Frontend — integração com ItemModal

- [x] 7.1 Em `apps/web/src/components/ItemModal.tsx`, ao abrir o modal, carregar checklists do item via `GET .../checklists` e passar como `initialChecklists` para `ChecklistSection`
- [x] 7.2 Adicionar seção `<ChecklistSection>` ao body do modal, após a seção de subtasks
- [x] 7.3 Assinar evento WebSocket `CHECKLIST_UPDATED` no `ItemModal` para atualizar os checklists em tempo real enquanto o modal estiver aberto

## 8. Frontend — indicador de progresso no KanbanCard

- [x] 8.1 Em `apps/web/src/components/KanbanCard.tsx`, adicionar campo `checklistProgress?: ChecklistProgress | null` na interface `CardData`
- [x] 8.2 Exibir no rodapé do card, quando `checklistProgress` não for null: ícone de checklist + texto `checked/total` e barra de progresso fina (height 2px) proporcional; cor verde quando `checked === total`
- [x] 8.3 Em `BoardPage.tsx`, garantir que `checklistProgress` retornado pela API é repassado ao `KanbanCard`

## 9. MCP — ferramentas de checklist

- [x] 9.1 Em `apps/mcp/src/tools/`, criar `checklist-tools.ts` com as ferramentas: `list_checklists`, `create_checklist`, `add_checklist_item`, `check_item`
- [x] 9.2 `list_checklists`: parâmetros `{ projectId, itemId }`; retorna array de checklists com itens e progresso
- [x] 9.3 `create_checklist`: parâmetros `{ projectId, itemId, name }`; retorna `{ id, name }`
- [x] 9.4 `add_checklist_item`: parâmetros `{ projectId, itemId, checklistId, text }`; retorna item criado
- [x] 9.5 `check_item`: parâmetros `{ projectId, itemId, checklistId, checklistItemId, checked: boolean }`; retorna item atualizado
- [x] 9.6 Registrar as ferramentas de checklist no servidor MCP principal

## 10. Validação

- [x] 10.1 Criar checklist via botão na modal e verificar que aparece com barra de progresso em 0/0
- [x] 10.2 Adicionar 3 itens, marcar 2 como concluídos e verificar barra em 2/3 na modal e `✓ 2/3` no KanbanCard do board
- [x] 10.3 Deletar um item e verificar atualização do progresso
- [x] 10.4 Deletar o checklist inteiro e verificar que o indicador desaparece do card
- [x] 10.5 Verificar que abrir o mesmo card em duas abas atualiza o progresso em tempo real (WebSocket)
- [x] 10.6 Testar as 4 ferramentas MCP via MCP inspector: criar checklist, adicionar item, marcar item, listar
