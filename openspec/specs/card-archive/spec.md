## ADDED Requirements

### Requirement: Status ARCHIVED em unified_items
O sistema SHALL suportar o status `ARCHIVED` em qualquer item (EPIC, STORY, TASK, BUG). Items arquivados são invisíveis no board Kanban e na tree view hierárquica por padrão. O status anterior ao arquivamento SHALL ser preservado em `status_before_archive` para permitir restauração fiel.

#### Scenario: Item arquivado não aparece no board
- **WHEN** um item possui status `ARCHIVED`
- **THEN** o item não é retornado pelas queries de board e tree view (filtro `status != 'ARCHIVED'` aplicado server-side)

#### Scenario: status_before_archive preservado ao arquivar
- **WHEN** item com status `IN_PROGRESS` é arquivado
- **THEN** `status_before_archive` é definido como `IN_PROGRESS` e `status` muda para `ARCHIVED`

#### Scenario: Mover card arquivado bloqueado
- **WHEN** usuário tenta arrastar ou mudar coluna de card com status `ARCHIVED`
- **THEN** operação é rejeitada pelo servidor com erro 422 "Item arquivado não pode ser movido"

---

### Requirement: Arquivamento em cascata pela hierarquia
O sistema SHALL arquivar em cascata todos os descendentes de um item ao arquivar um nó pai. A operação SHALL ser atômica (transação única).

#### Scenario: Arquivar épico arquiva toda a árvore abaixo
- **WHEN** usuário arquiva um EPIC
- **THEN** sistema arquiva o EPIC e todos os items cujo `ancestry_path` contém o id do EPIC, em uma única transação; todos passam a ter `status = 'ARCHIVED'` e seu status anterior preservado em `status_before_archive`

#### Scenario: Arquivar story arquiva tasks e subtasks abaixo
- **WHEN** usuário arquiva uma STORY
- **THEN** sistema arquiva a STORY e todos os seus descendentes (TASKs, BUGs, subtasks) em cascata

#### Scenario: Arquivar task folha arquiva apenas ela
- **WHEN** usuário arquiva task folha (sem filhos)
- **THEN** somente essa task tem status alterado para `ARCHIVED`

#### Scenario: Confirmação antes de arquivar nó pai
- **WHEN** usuário clica em "Arquivar" em item que possui descendentes não-arquivados
- **THEN** sistema exibe dialog de confirmação informando a quantidade de items que serão arquivados junto; o arquivamento só ocorre após confirmação explícita

---

### Requirement: Modal de itens arquivados e restauração
O sistema SHALL oferecer um botão "Ver itens arquivados" na barra de ações do board, que abre uma modal listando todos os items arquivados do projeto com opção de restauração individual.

#### Scenario: Botão "Ver itens arquivados" abre modal
- **WHEN** usuário clica no botão "Ver itens arquivados" na toolbar do board
- **THEN** modal é aberta exibindo todos os items com `status = 'ARCHIVED'` do projeto em formato de grid/tabela

#### Scenario: Grid de itens arquivados exibe informações contextuais
- **WHEN** modal de arquivados é exibida
- **THEN** cada linha mostra: ícone do tipo (EPIC/STORY/TASK/BUG), título do item, épico ancestral (nome), nome da coluna em que o item estava antes de ser arquivado (derivado de `status_before_archive` mapeado para coluna), e data do arquivamento

#### Scenario: Botão de arquivamento exibido apenas em items raiz arquivados
- **WHEN** modal lista items arquivados
- **THEN** items que são descendentes de outro item arquivado na lista são apresentados com indicação visual de que fazem parte de um grupo; o botão "Restaurar" individual fica disponível para todos, mas ao restaurar um descendente o sistema restaura também seus ancestrais arquivados em cascata

#### Scenario: Restaurar item retorna ao status anterior
- **WHEN** usuário clica em "Restaurar" em um item arquivado
- **THEN** sistema restaura o item com `status = status_before_archive` (ou `NOT_STARTED` se null), limpa `status_before_archive` e o item volta a aparecer no board/tree na coluna correspondente ao status restaurado

#### Scenario: Restaurar item com ancestral arquivado restaura a cadeia
- **WHEN** usuário restaura uma TASK cujo STORY pai ainda está arquivado
- **THEN** sistema restaura a TASK e recursivamente restaura todos os ancestrais arquivados até a raiz, para que o item seja visível no board e na tree view

#### Scenario: Restaurar épico restaura toda a árvore
- **WHEN** usuário clica em "Restaurar" em um EPIC arquivado
- **THEN** sistema restaura o EPIC e todos os seus descendentes arquivados em cascata, cada um para seu `status_before_archive`

#### Scenario: Modal sem itens arquivados
- **WHEN** projeto não possui nenhum item arquivado
- **THEN** modal exibe mensagem "Nenhum item arquivado neste projeto"

#### Scenario: Botão "Ver itens arquivados" oculto quando não há arquivados
- **WHEN** projeto não possui nenhum item com status `ARCHIVED`
- **THEN** botão "Ver itens arquivados" permanece visível mas com contador zero; alternativamente pode exibir um badge com a contagem quando maior que zero

---

### Requirement: Ação de arquivamento acessível nos cards e na tree view
O sistema SHALL expor a ação "Arquivar" nos menus de contexto de cards no board e nos menus de ação na tree view hierárquica.

#### Scenario: Arquivar via menu de contexto do card
- **WHEN** membro clica no menu "..." de um card no board e seleciona "Arquivar"
- **THEN** sistema exibe confirmação (se item tem descendentes) e executa o arquivamento em cascata

#### Scenario: Arquivar via ação na tree view
- **WHEN** membro clica no menu de ação de qualquer item na tree view e seleciona "Arquivar"
- **THEN** sistema exibe confirmação (se item tem descendentes) e executa o arquivamento em cascata

#### Scenario: Somente ADMIN e MEMBER podem arquivar
- **WHEN** usuário com papel VIEWER tenta arquivar item via API
- **THEN** sistema retorna 403
