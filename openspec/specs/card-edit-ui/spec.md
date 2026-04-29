## ADDED Requirements

### Requirement: Edição inline do título do card por duplo clique
O sistema SHALL permitir editar o título do card diretamente no board ao dar duplo clique sobre o texto do título.

#### Scenario: Ativar edição inline do título
- **WHEN** usuário dá duplo clique no título de um card
- **THEN** título é substituído por um campo de texto pré-preenchido com o valor atual e com foco ativo

#### Scenario: Salvar edição inline
- **WHEN** usuário pressiona Enter ou clica fora do campo
- **THEN** novo título é salvo via API e o card exibe o título atualizado

#### Scenario: Cancelar edição inline
- **WHEN** usuário pressiona Escape
- **THEN** campo fecha e o título original é restaurado sem salvar

---

### Requirement: Modal completa de edição ao duplo clique no corpo do card
O sistema SHALL abrir uma modal com todos os campos do card ao dar duplo clique em qualquer área do card que não seja o título.

#### Scenario: Abrir modal completa
- **WHEN** usuário dá duplo clique no corpo do card (exceto título)
- **THEN** modal abre exibindo todos os campos: título, descrição rich text (Tiptap), prioridade, responsável, story pai, tags, pontos, data de início, data de fim

#### Scenario: Salvar edições pela modal
- **WHEN** usuário altera campos e clica em "Salvar"
- **THEN** todas as alterações são enviadas via API e o card no board atualiza em tempo real

#### Scenario: Fechar modal sem salvar
- **WHEN** usuário clica em "Cancelar" ou pressiona Escape
- **THEN** modal fecha sem persistir alterações

#### Scenario: Criar subtask pela modal
- **WHEN** usuário clica em "Adicionar subtask" dentro da modal
- **THEN** formulário de criação de subtask é exibido vinculado ao card atual como pai

#### Scenario: Selecionar tags na modal
- **WHEN** usuário clica no seletor de tags dentro da modal
- **THEN** dropdown exibe todas as tags do projeto com chips coloridos; usuário pode selecionar e desselecionar múltiplas tags

---

### Requirement: Campo tipo na modal de edição de card

O sistema SHALL exibir e permitir editar o campo "Tipo" na `CardModal`.

#### Scenario: Exibir e editar tipo do card
- **WHEN** a `CardModal` é aberta
- **THEN** exibe um campo "Tipo" com select: `Task`, `Bug`, `Story`
- **AND** ao salvar, o `type` é incluído no body do `PATCH /projects/:id/tasks/:id`

#### Scenario: Card do tipo Story abre StoryModal
- **WHEN** o usuário clica no card de uma história (type = STORY) no board
- **THEN** a `StoryModal` é aberta em lugar da `CardModal`
- **AND** a `StoryModal` carrega os dados da história correspondente via `GET /projects/:id/stories/:storyId`

---

### Requirement: Seção de checklists na modal do card
O sistema SHALL exibir uma seção "Checklists" na `ItemModal` (e nas demais modais de card) após carregar o detalhe do item. A seção SHALL permitir criar novos checklists, adicionar/remover/editar itens e marcar itens como concluídos.

#### Scenario: Criar novo checklist na modal
- **WHEN** usuário clica em "+ Novo checklist" e confirma o nome
- **THEN** sistema cria o checklist via API e exibe a lista vazia com campo de adição de item

#### Scenario: Adicionar item ao checklist
- **WHEN** usuário digita o texto do item no campo e pressiona Enter ou clica em "+"
- **THEN** item é criado via API e aparece imediatamente na lista com checkbox desmarcado

#### Scenario: Marcar item como concluído
- **WHEN** usuário clica na checkbox de um item
- **THEN** estado `checked` alterna via API e o item é exibido com texto riscado e checkbox marcado; barra de progresso do checklist atualiza imediatamente

#### Scenario: Excluir item do checklist
- **WHEN** usuário clica no ícone de lixeira do item
- **THEN** item é removido via API e desaparece da lista; barra de progresso atualiza

#### Scenario: Excluir checklist inteiro
- **WHEN** usuário clica em "..." → "Excluir checklist"
- **THEN** checklist e todos os seus itens são removidos via API; seção desaparece da modal

#### Scenario: Barra de progresso por checklist
- **WHEN** checklist tem ao menos um item
- **THEN** modal exibe barra de progresso e texto `X/Y concluídos` no header do checklist; barra fica verde quando `X === Y`

---

### Requirement: Indicador de progresso de checklist no KanbanCard
O sistema SHALL exibir um indicador compacto de progresso de checklists no rodapé do `KanbanCard` quando o card possui ao menos um checklist com ao menos um item.

#### Scenario: Card com checklists no board
- **WHEN** card possui checklists e é exibido no board
- **THEN** rodapé exibe ícone de checklist + texto `checked/total` (ex: `✓ 3/7`); barra de progresso pequena abaixo do texto

#### Scenario: Card sem checklists no board
- **WHEN** card não possui nenhum checklist
- **THEN** nenhum indicador de checklist é exibido no rodapé do card

---

### Requirement: Campo Autor exibido na modal de edição
O sistema SHALL exibir o campo "Autor" na `CardModal` como informação somente leitura, posicionado próximo ao campo "Responsável" para contraste visual entre os dois papéis.

#### Scenario: Autor exibido na modal
- **WHEN** `CardModal` é aberta
- **THEN** campo "Autor" é exibido com avatar e nome do criador (ou "—" se null), sem input de edição

---

### Requirement: Botão "Histórico" na modal do card
O sistema SHALL exibir um botão "Histórico" (com ícone de relógio) no rodapé da `CardModal`, acima da seção de filhos, para acesso ao log de atividades.

#### Scenario: Botão Histórico visível na modal
- **WHEN** `CardModal` é aberta para qualquer task
- **THEN** botão "Histórico" é exibido no rodapé da modal, abaixo dos campos de edição e acima da seção de filhos

#### Scenario: Soma de horas exibida próximo ao botão
- **WHEN** task possui horas registradas em logs manuais
- **THEN** soma no formato "Xh Ym trabalhadas" é exibida ao lado ou abaixo do botão "Histórico"

#### Scenario: Clicar em Histórico abre ActivityLogModal
- **WHEN** usuário clica no botão "Histórico"
- **THEN** `ActivityLogModal` abre sobre a `CardModal` com z-index superior

---

### Requirement: Seção de filhos diretos no rodapé da modal
O sistema SHALL exibir, após o botão "Histórico", uma seção "Subtasks" listando os filhos diretos do card em grid de até 2 colunas.

#### Scenario: Seção Subtasks no rodapé
- **WHEN** `CardModal` é aberta para task com filhos diretos
- **THEN** seção "Subtasks" ocupa o final da modal (após todos os campos e o botão Histórico), com scroll interno se necessário

#### Scenario: Seção Subtasks ausente para tasks folha
- **WHEN** `CardModal` é aberta para task sem filhos
- **THEN** seção "Subtasks" exibe mensagem discreta "Nenhuma subtask" sem expandir a modal desnecessariamente

---

### Requirement: Campo Versão opcional na ItemModal (TASK/BUG)
O sistema SHALL exibir um campo "Versão" opcional na `ItemModal` de TASK e BUG, permitindo ao usuário associar o item a uma versão do projeto.

#### Scenario: Selecionar versão em TASK ou BUG
- **WHEN** usuário abre a `ItemModal` de uma TASK ou BUG e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido com select das versões disponíveis (ordenadas por posição) e opção "Sem versão"

#### Scenario: Salvar versão associada
- **WHEN** usuário seleciona uma versão e salva o item
- **THEN** `versionId` é incluído no body do `PATCH /projects/:id/items/:id` e persiste

#### Scenario: Campo Versão oculto quando projeto não tem versões
- **WHEN** projeto não possui versões cadastradas
- **THEN** campo "Versão" não é renderizado na ItemModal
