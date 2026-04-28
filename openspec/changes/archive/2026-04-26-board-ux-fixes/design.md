## Context

A primeira execução do Azy Board revelou que a camada de UI do board está incompleta: o backend e os dados já estão prontos (APIs de tasks, colunas, épicos, histórias e tags funcionam), mas o frontend não expõe esses recursos para o usuário. As correções são todas no frontend (`apps/web/src/`) sem alterações de schema ou API.

Estado atual problemático:
- `BoardPage.tsx` carrega dados mas não oferece forma de criar ou editar cards
- `KanbanCard.tsx` não tem interação de edição
- `dnd-kit` está integrado mas o handler `onDragEnd` não persiste a mudança de coluna corretamente (atualiza estado local mas não chama a API de forma consistente)
- O botão "Árvore" alterna a variável `view` mas o componente de Tree View não está implementado
- O toggle de subtasks tem lógica invertida e exibe a mensagem de erro no card em vez de filtrar

## Goals / Non-Goals

**Goals:**
- Botão "+" por coluna para criar cards
- Duplo clique no título do card → edição inline; duplo clique no corpo → modal completa
- Modal de edição com todos os campos: título, descrição (Tiptap), prioridade, responsável, story, tags, pontos, datas
- Painel/modal para criar e editar épicos e histórias
- Drag-and-drop de cards entre colunas funcionando e persistido via API
- Drag-and-drop de colunas para reordenar
- Criação e atribuição de tags pela UI
- Toggle de subtasks com comportamento correto da Leaf Rule
- Tree View funcional como tabela hierárquica expansível

**Non-Goals:**
- Alterações no backend ou schema do banco
- Novas rotas de API
- Funcionalidades de anexos ou avatar (já especificadas em outra change)

## Decisions

### D1 — Drag-and-drop de cards: usar `droppable` por coluna com `DragOverlay`

**Problema atual:** o `onDragEnd` do dnd-kit identifica o `over.id` como o ID do item mais próximo (outro card), não o ID da coluna. Isso faz o card não fixar na coluna correta.

**Solução:** Usar o padrão recomendado pelo dnd-kit para Kanban: cada coluna é um `SortableContext` com `id` da coluna. No `onDragEnd`, verificar se `over.id` é ID de coluna ou de card; se for card, resolver a coluna pai. A chamada à API `PATCH /tasks/:id/move` só acontece após o drop bem-sucedido.

---

### D2 — Drag-and-drop de colunas: segundo `DndContext` aninhado

**Solução:** Um `DndContext` externo controla o reorder de colunas (drag no header da coluna). O `DndContext` interno controla o drag de cards. Os dois contextos não interferem porque os sensors são separados e os IDs de colunas e cards são distintos.

---

### D3 — Modal de edição do card: componente `CardModal`

**Solução:** Componente `CardModal` recebe o `taskId` e busca os dados completos via `GET /projects/:id/tasks?id=...`. Usa Tiptap para a descrição. Campos de tags são multi-select com os chips coloridos do projeto. Salva via `PATCH /projects/:id/tasks/:taskId`.

Duplo clique no título → `InlineEdit` (input in-place, confirma com Enter ou blur).
Duplo clique no corpo do card → abre `CardModal`.

---

### D4 — Criação de card: formulário rápido inline na coluna

**Solução:** Botão "+" no rodapé de cada coluna. Clicando, expande um formulário compacto (apenas título) diretamente na coluna. Pressionar Enter ou clicar em "Adicionar" cria o card via API e fecha o formulário. Para campos completos, o card criado pode ser aberto pela modal.

---

### D5 — Tree View: componente `TreeViewPage` substituindo o board

**Solução:** Quando `view === 'tree'`, renderizar `TreeViewPage` que busca `GET /projects/:id/tree` e constrói a tabela hierárquica. Cada linha tem ícone de expandir/colapsar. Colunas: Nome, Status, Responsável, Pontos, Progresso, Data Início, Data Fim. Tasks folha mostram todas as colunas editáveis inline. Estado de colapso por nó guardado em `useState` local.

---

### D6 — Toggle de subtasks: filtro no array de tasks em memória

**Comportamento correto:**
- Toggle **desativado** (padrão): mostrar apenas tasks do primeiro nível de cada story — ou seja, tasks sem `parentId`. Subtasks não aparecem.
- Toggle **ativado** (Leaf Rule): mostrar apenas tasks folha — tasks que não aparecem como `parentId` de nenhuma outra task carregada.

A frase de aviso "Esta task possui subtasks..." deve ser removida dos cards. Ela era um placeholder de bloqueio de drag que não deveria ser visível para o usuário.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Dois DndContexts podem causar conflito de eventos | Usar `id` prefixados distintos para colunas (`col-xxx`) e cards (`card-xxx`) |
| Modal de card pode ser lenta ao buscar dados completos | Exibir skeleton loader enquanto carrega; manter dados básicos do card na lista |
| Tiptap pode ter flash de conteúdo ao abrir modal | Inicializar o editor com o conteúdo já carregado antes de exibir |
| Tree View com muitos nós pode ser lenta | Virtualização não necessária no MVP; limitar expansão automática ao primeiro nível |
