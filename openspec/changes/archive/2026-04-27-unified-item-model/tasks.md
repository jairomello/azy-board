## 1. Schema Drizzle — tabela `items`

- [x] 1.1 Em `apps/api/src/db/schema.ts`, renomear a tabela `tasks` para `items`: atualizar `sqliteTable('tasks', ...)` para `sqliteTable('items', ...)` e a constante exportada de `tasks` para `items`
- [x] 1.2 Atualizar enum `type` da tabela `items` para `EPIC | STORY | TASK | BUG` (adicionar `EPIC` e manter os demais)
- [x] 1.3 Adicionar colunas faltantes na tabela `items` para suportar STORY e EPIC: `moduleId TEXT REFERENCES modules(id)`, `persona TEXT`, `goal TEXT`, `benefit TEXT`, `acceptanceCriteria TEXT`, `notes TEXT` — todas nullable
- [x] 1.4 Renomear tabela `task_tags` → `item_tags` e coluna `task_id` → `item_id` com FK para `items`
- [x] 1.5 Renomear tabela `task_sprints` → `item_sprints` e coluna `task_id` → `item_id` com FK para `items`
- [x] 1.6 Atualizar tabela `attachments`: renomear coluna `task_id` → `item_id` com FK para `items`
- [x] 1.7 Remover tabelas `epics` e `stories` do schema (deletar suas definições e relations)
- [x] 1.8 Atualizar todas as `relations` do Drizzle: `itemsRelations` (auto-ref `parent`/`children`), `itemTagsRelations`, `itemSprintsRelations`, `attachmentsRelations`; remover `epicsRelations`, `storiesRelations`
- [x] 1.9 Rodar `bun drizzle-kit push` para aplicar o schema no banco local (drop + recreate)

## 2. Seed — dados de exemplo com todos os tipos

- [x] 2.1 Reescrever `apps/api/src/db/seed.ts`: dropar e recriar o banco, depois inserir dados de exemplo na tabela `items` cobrindo todos os tipos
- [x] 2.2 O seed SHALL inserir: 1 tenant, 1 usuário admin, 1 projeto, 2 módulos, 4 colunas, 2 EPICs (um por módulo), 4 STORYs (2 por EPIC), 8 TASKs (2 por STORY), 2 BUGs (1 por EPIC), 2 subtasks de TASK
- [x] 2.3 Construir o campo `ancestryPath` corretamente em cada item do seed: JSON array `[{ id, title, type }]` de todos os ancestrais do item, do mais distante ao mais próximo
- [x] 2.4 Rodar `bun run seed` e verificar que o banco é populado sem erros

## 3. Tipos TypeScript — interface `Card` e `ItemType`

- [x] 3.1 Em `packages/types/src/card.ts` (arquivo novo), definir `type ItemType = 'EPIC' | 'STORY' | 'TASK' | 'BUG'`
- [x] 3.2 Definir interface `Card` com campos: `id`, `type: ItemType`, `title`, `columnId: string | null`, `priority: string | null`, `points: number | null`, `assigneeId: string | null`, `tags: Tag[]`, `isLeaf: boolean`, `ancestryPath: AncestorRef[]`, `parentId: string | null`, `moduleId: string | null`
- [x] 3.3 Exportar função `toCard(item: Item): Card` que mapeia um item do banco para a interface `Card`; `isLeaf` é `true` quando o item não tem filhos (campo calculado retornado pela API)
- [x] 3.4 Exportar `Card`, `ItemType`, `AncestorRef` do `packages/types/src/index.ts`

## 4. Backend — rotas `/projects/:id/items`

- [x] 4.1 Criar `apps/api/src/routes/items.ts` com handler `GET /projects/:id/items`: aceita query params `type` (comma-separated), `parentId`, `columnId`, `leaf=true`, `moduleId`; aplica `withTenant` // [TENANT] tenant_id obrigatório em toda query de items
- [x] 4.2 Implementar `POST /projects/:id/items`: valida hierarquia por tipo (EPIC → parentId null + moduleId; STORY → parentId é EPIC; TASK/BUG → parentId é STORY/TASK/BUG); gera `id` (nanoid), calcula `ancestryPath` e persiste // [TENANT] incluir tenantId do JWT no insert
- [x] 4.3 Implementar `PATCH /projects/:id/items/:itemId`: permite atualizar campos comuns e campos específicos de tipo (persona, goal, etc.); recalcula `ancestryPath` se `parentId` mudar
- [x] 4.4 Implementar `PATCH /projects/:id/items/:itemId/move`: atualiza `columnId` e `status` do item; verifica que item é TASK ou BUG antes de mover // [TENANT] anti-IDOR: confirmar projectId + tenantId
- [x] 4.5 Implementar `PATCH /projects/:id/items/reorder`: recebe `{ columnId, order: string[] }` e atualiza `position` de cada item em transaction // [DB-SWAP] usar transaction do PostgreSQL em produção
- [x] 4.6 Implementar `DELETE /projects/:id/items/:itemId`: valida que usuário tem role ADMIN ou MEMBER; impede deleção se item tem filhos (retorna 409 com contagem de filhos)
- [x] 4.7 Implementar `GET /projects/:id/items/tree`: retorna árvore completa ordenada por tipo e position; cada nó inclui `children` aninhados; respeita filtros `moduleId`, `assigneeId`, `sprintId` // [TENANT] withTenant obrigatório
- [x] 4.8 Implementar `GET /projects/:id/items/:itemId`: retorna item único com tags, sprints, attachments e children count
- [x] 4.9 Registrar as rotas de items no app principal (`apps/api/src/index.ts`); remover importações e registros das rotas `/epics`, `/stories` e `/tasks`
- [x] 4.10 Atualizar rotas de tags para usar `/projects/:id/items/:itemId/tags` (substituindo `/tasks/:id/tags`); atualizar rotas de sprints para `/items/:itemId/sprints`; atualizar rotas de attachments para `item_id`

## 5. Frontend — tipos e serviço de API

- [x] 5.1 Em `apps/web/src/types/item.ts` (novo arquivo), importar e reexportar `Card`, `ItemType`, `toCard` de `packages/types`; definir tipo `Item` que representa a resposta raw da API
- [x] 5.2 Em `apps/web/src/lib/api.ts` (ou equivalente), adicionar funções: `getItems(projectId, params)`, `createItem(projectId, data)`, `updateItem(projectId, itemId, data)`, `moveItem(projectId, itemId, columnId)`, `reorderItems(projectId, columnId, order)`, `deleteItem(projectId, itemId)`, `getItemsTree(projectId, params)`
- [x] 5.3 Remover funções de API antigas relacionadas a `/epics`, `/stories` e `/tasks` do cliente

## 6. Frontend — KanbanCard.tsx

- [x] 6.1 Atualizar props de `KanbanCard` para receber `Card` (interface unificada) em vez de tipo separado
- [x] 6.2 Atualizar mapa de cores do badge de tipo: `EPIC` → laranja/âmbar (`#f59e0b`), `STORY` → roxo (`#8b5cf6`), `TASK` → azul (`#3b82f6`), `BUG` → vermelho (`#ef4444`)
- [x] 6.3 Garantir que drag-and-drop via `useSortable` passa `disabled: true` para items com `type IN (EPIC, STORY)` ou com `isLeaf = false`

## 7. Frontend — Modais por tipo

- [x] 7.1 Renomear `CardModal.tsx` → `ItemModal.tsx`; atualizar campos para refletir TASK/BUG: Título, Tipo (select TASK/BUG), Coluna, História pai (select de items com `type=STORY`), Responsável, Prioridade, Pontos, Sprint, Tags, Subtasks, Data início/fim, Descrição, Bloqueio
- [x] 7.2 Atualizar `EpicModal.tsx`: substituir chamadas a `/epics` por `POST/PATCH /projects/:id/items` com `type=EPIC`; campo Módulo continua obrigatório
- [x] 7.3 Atualizar `StoryModal.tsx`: substituir chamadas a `/stories` por `POST/PATCH /projects/:id/items` com `type=STORY`; campo "Épico pai" passa a ser select de items com `type=EPIC` do projeto
- [x] 7.4 Em `BoardPage.tsx`, implementar função `openModalForItem(item: Card)` que seleciona a modal correta pelo `type`: EPIC → `EpicModal`, STORY → `StoryModal`, TASK/BUG → `ItemModal`

## 8. Frontend — BoardPage.tsx

- [x] 8.1 Substituir todos os `useEffect` e chamadas de `/epics`, `/stories` e `/tasks` por chamadas a `/items` com filtros de tipo (`getItems(projectId, { type: 'EPIC' })`, `getItems(projectId, { type: 'TASK,BUG', leaf: true })`)
- [x] 8.2 Atualizar o estado principal do board: `epics: Item[]` e `cards: Card[]` derivados da mesma fonte `/items`; aplicar `toCard()` para montar os cards do Kanban
- [x] 8.3 Atualizar handlers de drag: `handleDragEnd` deve chamar `moveItem` (troca de coluna) ou `reorderItems` (mesma coluna) usando os endpoints de `/items`
- [x] 8.4 Toggle "Mostrar histórias" passa a buscar `getItems(projectId, { type: 'STORY' })` e exibir esses items como cards virtuais na primeira coluna

## 9. Frontend — Toolbar com 4 botões de criação

- [x] 9.1 Substituir os botões atuais (`+ Novo Épico`, `+ Nova História`) por quatro botões na ordem: `+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug`
- [x] 9.2 `+ Nova Task` abre `ItemModal` em modo de criação com `type=TASK` pré-selecionado
- [x] 9.3 `+ Novo Bug` abre `ItemModal` em modo de criação com `type=BUG` pré-selecionado e campo Tipo bloqueado em BUG

## 10. Frontend — AddCardForm.tsx

- [x] 10.1 Atualizar `AddCardForm` para enviar para `POST /projects/:id/items` em vez de `/tasks`
- [x] 10.2 Seletor de tipo no formulário rápido mantém opções `Task` (padrão) e `Bug`; ao confirmar, envia `type` correto no body

## 11. Frontend — Tree View

- [x] 11.1 Atualizar a Tree View para consumir `GET /projects/:id/items/tree` em vez de `/tree`
- [x] 11.2 Adicionar ícone de tipo em cada nó da árvore (EPIC → ícone de raio ou âmbar, STORY → ícone de livro/roxo, TASK → ícone de check/azul, BUG → ícone de bug/vermelho)
- [x] 11.3 Garantir que a edição inline na Tree View chama `PATCH /projects/:id/items/:id`

## 12. Frontend — BoardFilters.tsx

- [x] 12.1 Atualizar `BoardFilters` para carregar opções de responsáveis de `/projects/:id/members` (sem mudança) e opções de tipo como array estático `['TASK', 'BUG']` (sem EPIC/STORY nos filtros de tipo do board)
- [x] 12.2 Aplicar filtro de tipo sobre `displayedCards` usando o campo `type` do `Card`

## 13. Validação

- [x] 13.1 Testar criação de item EPIC: verificar que é salvo com `parentId = null` e `moduleId` preenchido
- [x] 13.2 Testar criação de item STORY: verificar que `parentId` aponta para EPIC e rejeita parentId de TASK (400)
- [x] 13.3 Testar criação de TASK e BUG: verificar que aparecem no board como cards com badge correto
- [x] 13.4 Testar Leaf Rule: criar subtask de TASK e verificar que o TASK pai sai do board e subtask aparece
- [x] 13.5 Testar os 4 botões de criação no toolbar: cada um abre a modal correta e cria o item no tipo correto
- [x] 13.6 Testar toggle "Mostrar histórias": ativar e verificar que items STORY aparecem na primeira coluna como cards não arrastáveis
- [x] 13.7 Testar Tree View: verificar que exibe EPIC → STORY → TASK/BUG → subtask com ícones de tipo
- [x] 13.8 Testar reordenação vertical e mudança de coluna: verificar persistência após recarregar
- [x] 13.9 Rodar `bun run seed` após todas as mudanças e verificar que o board exibe dados de exemplo com todos os tipos
