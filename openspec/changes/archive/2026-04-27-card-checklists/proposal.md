## Why

O Azy Board é prioritariamente construído para que agentes de IA (como Claude) executem trabalho real enquanto humanos acompanham o progresso. Quando um agente assume um card TASK, ele frequentemente precisa executar uma sequência de passos internos — criar subtasks formais para cada passo cria ruído no board, interfere na Leaf Rule e cria itens de trabalho desnecessários no backlog. Um checklist nomeado, leve e interno ao card é a forma natural de um agente declarar e rastrear seus passos de execução sem poluir a hierarquia de itens.

## What Changes

- **Nova tabela `checklists`**: cada card pode ter múltiplos checklists, cada um com nome e posição.
- **Nova tabela `checklist_items`**: cada checklist tem itens ordenados com estado `checked/unchecked` e texto.
- **Backend**: rotas CRUD sob `/projects/:id/items/:itemId/checklists` e sub-rotas de itens.
- **Frontend — ItemModal**: nova seção de checklists com criação de listas nomeadas, adição/remoção/reordenação de itens e checkbox interativo.
- **Frontend — KanbanCard**: barra de progresso compacta no rodapé do card quando há ao menos um checklist (ex: `3/7`).
- **MCP**: ferramentas `create_checklist`, `add_checklist_item`, `check_item`, `list_checklists` para que agentes gerenciem checklists programaticamente via protocolo MCP.

## Capabilities

### New Capabilities

- `card-checklists`: Checklists nomeados dentro de qualquer card — múltiplas listas por card, itens ordenados, estado de conclusão por item, barra de progresso agregada.

### Modified Capabilities

- `card-edit-ui`: ItemModal (e demais modais de card) ganham seção de checklists com UI completa de criação e edição.
- `mcp-server`: Novas ferramentas MCP para criação e atualização de checklists por agentes de IA.

## Impact

- **Banco de dados**: 2 novas tabelas (`checklists`, `checklist_items`) com FK para `items` e `tenants`.
- **API**: novas rotas sob `/projects/:id/items/:itemId/checklists` (GET, POST, PATCH, DELETE).
- **Frontend**: `ItemModal.tsx`, `KanbanCard.tsx` (novo componente `ChecklistSection`).
- **MCP**: `apps/mcp/src/tools/` — 4 novas ferramentas.
- **Schema Drizzle**: `apps/api/src/db/schema.ts`.
- **Sem breaking changes**: checklists são opcionais; cards existentes sem checklists não são afetados.
