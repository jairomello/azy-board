## 1. Correção do Drag-and-Drop de Cards

- [x] 1.1 Refatorar `BoardPage.tsx`: usar `DragOverlay` corretamente e resolver coluna destino no `onDragEnd` (verificar se `over.id` é coluna ou card; se card, buscar `columnId` do card)
- [x] 1.2 Garantir que `onDragEnd` chama `api.patch(.../move)` com o `columnId` correto e faz rollback visual em caso de erro da API
- [x] 1.3 Cada coluna deve ser um `<DroppableColumn>` com `useDroppable({ id: col.id })` para aceitar drops de cards
- [x] 1.4 Testar drag entre colunas: card deve fixar na coluna destino e exibir o status correto após o drop

## 2. Reordenação de Colunas

- [x] 2.1 Criar componente `<SortableColumn>` usando `useSortable` do dnd-kit com drag ativado apenas no header
- [x] 2.2 Envolver as colunas em um segundo `SortableContext` (horizontal) para reordenação de colunas
- [x] 2.3 No `onDragEnd` do contexto de colunas, chamar `api.patch(.../columns/reorder)` com a nova ordem
- [x] 2.4 Garantir que o DndContext de colunas e o de cards não interferem (usar sensor com `activationConstraint` diferente para colunas)

## 3. Criação de Cards

- [x] 3.1 Criar componente `<AddCardForm>` — formulário inline compacto com input de título, botões "Adicionar" (Enter) e "Cancelar" (Escape)
- [x] 3.2 Adicionar botão "+" no rodapé de cada coluna no `BoardPage.tsx` que exibe o `<AddCardForm>`
- [x] 3.3 Ao confirmar, chamar `api.post(.../tasks)` com `columnId` da coluna e adicionar o card ao estado local otimisticamente
- [x] 3.4 Fechar o formulário após criação bem-sucedida; exibir toast de erro em caso de falha

## 4. Edição Inline do Título do Card

- [x] 4.1 Criar componente `<InlineEdit>` — renderiza texto ou input dependendo do estado `editing`; ativa com duplo clique; salva com Enter/blur; cancela com Escape
- [x] 4.2 Integrar `<InlineEdit>` no `KanbanCard.tsx` para o campo de título
- [x] 4.3 Ao salvar, chamar `api.patch(.../tasks/:id)` com o novo título
- [x] 4.4 Remover a exibição da frase "Esta task possui subtasks..." dos cards (era placeholder de bloqueio — tornar o bloqueio silencioso via `cursor-not-allowed`)

## 5. Modal Completa de Edição do Card

- [x] 5.1 Criar componente `<CardModal>` com overlay e painel lateral ou centralizado
- [x] 5.2 Campos da modal: título (`<InlineEdit>`), descrição (Tiptap rich text), prioridade (select), responsável (select de membros), story pai (select agrupado por épico), tags (multi-select com chips), pontos (input numérico), data início e data fim
- [x] 5.3 Buscar dados completos da task via `GET /projects/:id/tasks` filtrado por ID ao abrir a modal
- [x] 5.4 Botão "Adicionar subtask" dentro da modal que exibe `<AddCardForm>` com `parentId` pré-definido
- [x] 5.5 Ao clicar em "Salvar", chamar `api.patch(.../tasks/:id)` com todos os campos alterados; fechar modal e atualizar card no board
- [x] 5.6 Integrar abertura da modal no `KanbanCard.tsx`: duplo clique em qualquer área exceto título chama `onOpenDetail(card.id)`
- [x] 5.7 Adicionar skeleton loader na modal enquanto os dados completos carregam

## 6. Seletor e Criação de Tags

- [x] 6.1 Criar componente `<TagSelector>` — dropdown multi-select que lista tags do projeto como chips coloridos
- [x] 6.2 No `<TagSelector>`, ao digitar nome não existente, exibir opção "Criar tag '[nome]'" que chama `api.post(.../tags)`
- [x] 6.3 Adicionar paleta de cores predefinidas no formulário de criação de tag (8-10 cores)
- [x] 6.4 Integrar `<TagSelector>` na `<CardModal>` e conectar com `api.post(.../tasks/:id/tags)`
- [x] 6.5 Buscar tags do projeto no `BoardPage.tsx` e passar como prop para os componentes que precisam

## 7. Gerenciamento de Épicos e Histórias

- [x] 7.1 Criar componente `<EpicModal>` — modal para criar/editar épico com campos: título, módulo (select), descrição
- [x] 7.2 Adicionar botão de edição (ícone de lápis) no header de cada swimlane de épico que abre `<EpicModal>` em modo de edição
- [x] 7.3 Adicionar botão "Novo épico" acessível do board (ex: botão no toolbar ou no header da área de swimlanes)
- [x] 7.4 Criar componente `<StorySelector>` — dropdown para selecionar história agrupada por épico, com opção "Nova história" inline
- [x] 7.5 Integrar `<StorySelector>` na `<CardModal>` para o campo de story pai
- [x] 7.6 Ao criar nova história pelo `<StorySelector>`, chamar `api.post(.../stories)` e adicionar à lista do dropdown

## 8. Correção do Toggle de Subtasks

- [x] 8.1 Corrigir a lógica de filtragem no `BoardPage.tsx`:
  - Toggle desativado: `tasks.filter(t => !t.parentId)` — apenas tasks raiz
  - Toggle ativado: aplicar Leaf Rule — `tasks.filter(t => !parentIdSet.has(t.id))`
- [x] 8.2 Recalcular `parentIdSet` toda vez que a lista de tasks mudar
- [x] 8.3 Garantir que o label do toggle reflete claramente o estado: "Mostrar subtasks" quando desativado, "Ocultar subtasks" quando ativado

## 9. Implementação da Tree View

- [x] 9.1 Criar componente `<TreeViewPage>` que busca `GET /projects/:id/tree` ao montar
- [x] 9.2 Renderizar tabela hierárquica com linhas indentadas por `depth`; cada nó tem ícone de expandir/colapsar
- [x] 9.3 Colunas da tabela para tasks/subtasks: Nome, Status (badge), Responsável (avatar), Pontos, Progresso (barra), Data Início, Data Fim
- [x] 9.4 Estado de expandido/colapsado por nó em `useState<Set<string>>`; primeiro nível expandido por padrão
- [x] 9.5 Botões "Expandir tudo" e "Recolher tudo" no toolbar da Tree View
- [x] 9.6 Integrar `<TreeViewPage>` no `BoardPage.tsx`: quando `view === 'tree'`, renderizar `<TreeViewPage>` no lugar das swimlanes
- [x] 9.7 Botão "Kanban" no seletor volta para `view === 'kanban'`
- [x] 9.8 Exibir skeleton loader com linhas de largura variável enquanto a árvore carrega

## 10. Testes e Validação

- [x] 10.1 Testar drag-and-drop de cards: mover card para cada coluna e verificar status correto persistido
- [x] 10.2 Testar rollback visual: simular falha da API e verificar que card retorna à coluna original
- [x] 10.3 Testar reordenação de colunas: arrastar coluna e verificar nova ordem persistida
- [x] 10.4 Testar criação de card: criar pelo formulário rápido em cada coluna
- [x] 10.5 Testar edição inline: duplo clique no título, editar, Enter e Escape
- [x] 10.6 Testar modal completa: abrir, editar todos os campos, salvar e verificar atualização no board
- [x] 10.7 Testar tags: criar nova tag, atribuir a card, remover tag do card
- [x] 10.8 Testar épicos e histórias: criar épico, criar história, selecionar história em card
- [x] 10.9 Testar toggle de subtasks: verificar comportamento correto com tasks raiz e Leaf Rule
- [x] 10.10 Testar Tree View: alternar visão, expandir/recolher nós, expandir tudo/recolher tudo
