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
