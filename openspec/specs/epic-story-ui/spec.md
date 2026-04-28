## MODIFIED Requirements

### Requirement: Quatro botões de criação no toolbar do board
O sistema SHALL exibir quatro botões de criação no toolbar do board, na seguinte ordem da esquerda para a direita: `+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug`. Cada botão abre a modal correspondente ao tipo de item.

#### Scenario: Botões exibidos no toolbar
- **WHEN** usuário acessa o board de um projeto
- **THEN** toolbar exibe os quatro botões de criação na ordem: `+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug`

#### Scenario: Criar novo épico
- **WHEN** usuário clica em `+ Novo Épico`
- **THEN** `EpicModal` abre em modo de criação com campos: Título (obrigatório), Módulo (select obrigatório), Descrição (opcional)
- **AND** ao confirmar, item é criado via `POST /projects/:id/items` com `type = EPIC` e nova swimlane aparece no board

#### Scenario: Criar nova história
- **WHEN** usuário clica em `+ Nova História`
- **THEN** `StoryModal` abre em modo de criação com campos: Título, Épico pai (select de items com `type = EPIC`), Como/Eu quero/Para que, Critérios de Aceitação (rich text), Notas (rich text)
- **AND** ao confirmar, item é criado via `POST /projects/:id/items` com `type = STORY`

#### Scenario: Criar nova task
- **WHEN** usuário clica em `+ Nova Task`
- **THEN** `ItemModal` abre em modo de criação com campos: Título, Coluna (select), História pai (select de items com `type = STORY`), Responsável, Prioridade, Pontos, Sprint, Tags
- **AND** ao confirmar, item é criado via `POST /projects/:id/items` com `type = TASK`

#### Scenario: Criar novo bug
- **WHEN** usuário clica em `+ Novo Bug`
- **THEN** `ItemModal` abre em modo de criação com `type = BUG` pré-selecionado e os mesmos campos de TASK
- **AND** ao confirmar, item é criado via `POST /projects/:id/items` com `type = BUG`

---

### Requirement: EpicModal — criação e edição de épicos
O sistema SHALL fornecer `EpicModal` com campos: Título, Módulo (select de módulos do projeto) e Descrição.

#### Scenario: Editar épico existente
- **WHEN** usuário clica no ícone de edição no header da swimlane de um EPIC
- **THEN** `EpicModal` abre em modo de edição com os dados do épico preenchidos

#### Scenario: Salvar épico
- **WHEN** usuário confirma o formulário da EpicModal
- **THEN** sistema chama `POST /projects/:id/items` (criação) ou `PATCH /projects/:id/items/:id` (edição) e atualiza o board em tempo real

---

### Requirement: StoryModal — criação e edição de histórias com campos ágeis e rich text
O sistema SHALL fornecer `StoryModal` com campos: Título, Épico pai (select), Como (persona), Eu quero (goal), Para que (benefit), Critérios de Aceitação (editor Tiptap), Notas (editor Tiptap).

#### Scenario: Selecionar épico pai na StoryModal
- **WHEN** StoryModal é aberta em modo de criação
- **THEN** campo "Épico" exibe select com items do projeto onde `type = EPIC`

#### Scenario: Salvar história
- **WHEN** usuário confirma o formulário da StoryModal
- **THEN** sistema chama `POST /projects/:id/items` (criação) ou `PATCH /projects/:id/items/:id` (edição) com os campos ágeis e conteúdo rich text

---

### Requirement: ItemModal — criação e edição de TASK e BUG
O sistema SHALL fornecer `ItemModal` (substitui `CardModal`) com campos: Título, Tipo (TASK/BUG), Coluna (select), História pai (select de STORYs do projeto), Responsável, Prioridade, Pontos, Sprint (select), Tags, Subtasks (lista), Data início, Data fim, Descrição, Bloqueio.

#### Scenario: Alterar tipo entre TASK e BUG na ItemModal
- **WHEN** usuário altera o campo Tipo na ItemModal de TASK para BUG
- **THEN** badge do item é atualizado visualmente no preview e salvo via `PATCH /projects/:id/items/:id`

#### Scenario: Selecionar história pai na ItemModal
- **WHEN** usuário clica no campo "História"
- **THEN** dropdown exibe items do projeto onde `type = STORY`, agrupados pelo EPIC pai
