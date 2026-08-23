## Purpose

Definir os requisitos da capacidade epic story ui.

## Requirements

### Requirement: Cinco botões de criação no toolbar do board
O sistema SHALL exibir cinco botões de criação no toolbar do board, na seguinte ordem da esquerda para a direita: `+ Módulo`, `+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug`. Cada botão abre a modal correspondente ao tipo de item. O botão "+ Módulo" abre uma modal de criação de módulo com campos Nome (obrigatório) e Descrição (opcional).

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

### Requirement: Renderização do board com nível de Módulo
O sistema SHALL renderizar o board com a hierarquia visual Módulo >> Épico >> História >> Cards no modo `Hierarquia` e Módulo (aba ativa) >> Épico >> História >> Cards no modo `Abas`, mantendo a mesma estrutura interna de swimlanes. As swimlanes de Épico SHALL ser aninhadas dentro das ModuleSwimlanes correspondentes.

#### Scenario: Board com múltiplos módulos
- **WHEN** projeto possui 3 módulos com épicos
- **THEN** board exibe 3 ModuleSwimlanes, cada uma contendo as swimlanes de Épico do respectivo módulo

#### Scenario: Épico movido para outro módulo
- **WHEN** épico tem seu `moduleId` alterado via EpicModal
- **THEN** a swimlane do épico é movida para a ModuleSwimlane do novo módulo no board em tempo real

#### Scenario: Renderização por aba
- **WHEN** o modo selecionado é `Abas` e uma aba de módulo está ativa
- **THEN** somente o grupo do módulo ativo é renderizado com seus épicos, histórias e colunas

#### Scenario: Criação disponível nos modos
- **WHEN** o usuário está em qualquer um dos modos de apresentação
- **THEN** os controles de criação de módulo, épico, história, task e bug continuam disponíveis e funcionais

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

---

### Requirement: Campo Versão opcional na EpicModal e StoryModal
O sistema SHALL exibir um campo "Versão" opcional na `EpicModal` e na `StoryModal`, permitindo associar épicos e histórias a versões do projeto.

#### Scenario: Selecionar versão em Épico
- **WHEN** usuário abre a `EpicModal` e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido com select das versões disponíveis e opção "Sem versão"

#### Scenario: Selecionar versão em História
- **WHEN** usuário abre a `StoryModal` e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido com select das versões disponíveis e opção "Sem versão"

#### Scenario: Salvar versão em Épico ou História
- **WHEN** usuário seleciona uma versão e salva
- **THEN** `versionId` é incluído no body do PATCH do respectivo item e persiste

#### Scenario: Campo Versão oculto quando projeto não tem versões
- **WHEN** projeto não possui versões cadastradas
- **THEN** campo "Versão" não é renderizado nas modais de Épico e História
