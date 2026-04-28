## MODIFIED Requirements

### Requirement: Quatro tipos de item: EPIC, STORY, TASK, BUG
O sistema SHALL suportar quatro tipos de item discriminados pelo campo `type` na tabela `items`: `EPIC`, `STORY`, `TASK`, `BUG`. O tipo `STORY` deixa de existir como tipo de card de task avulso — todos os items são da tabela `items`.

#### Scenario: Badge de tipo visível no card
- **WHEN** um card é exibido no board
- **THEN** badge com o tipo (`Epic`, `Story`, `Task`, `Bug`) é exibido no rodapé do card

#### Scenario: Tipo padrão ao criar card pelo formulário rápido
- **WHEN** card é criado pelo botão "+" na coluna
- **THEN** o tipo padrão é `TASK`; o formulário expõe seletor de tipo com opções `Task` e `Bug`

#### Scenario: Seletor de tipo na modal de edição
- **WHEN** modal de edição de card TASK ou BUG é aberta
- **THEN** campo "Tipo" exibe select com opções `Task` e `Bug` (EPIC e STORY não são editáveis como tipo aqui)

#### Scenario: Cores diferenciadas por tipo
- **WHEN** badge de tipo é renderizado
- **THEN** `Epic` aparece em laranja/âmbar, `Story` em roxo/violeta, `Task` em azul neutro, `Bug` em vermelho

---

### Requirement: Modal diferenciada por tipo
O sistema SHALL abrir a modal de edição correspondente ao `type` do item clicado. Não existe uma única modal universal.

#### Scenario: Clicar em card TASK ou BUG abre ItemModal
- **WHEN** usuário clica em card com `type IN (TASK, BUG)`
- **THEN** `ItemModal` é aberta com campos: Título, Tipo (TASK/BUG), Descrição, Responsável, Prioridade, Pontos, Sprint, Tags, Subtasks, Data início/fim

#### Scenario: Clicar em card STORY abre StoryModal
- **WHEN** usuário clica em card ou item com `type = STORY`
- **THEN** `StoryModal` é aberta com campos ágeis: Título, Épico pai, Como/Eu quero/Para que, Critérios de Aceitação (rich text), Notas (rich text)

#### Scenario: Clicar em header de swimlane EPIC abre EpicModal
- **WHEN** usuário clica no botão de edição no header da swimlane de um EPIC
- **THEN** `EpicModal` é aberta com campos: Título, Módulo, Descrição

---

### Requirement: Persistência do tipo no banco
O sistema SHALL persistir o campo `type` como `TEXT NOT NULL` com enum `EPIC | STORY | TASK | BUG` e default `TASK` na tabela `items`.

#### Scenario: Tipo persistido na criação
- **WHEN** item é criado via `POST /projects/:id/items` com `type` no body
- **THEN** banco registra o `type` informado; se ausente, usa `TASK` como default
