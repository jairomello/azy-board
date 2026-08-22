## MODIFIED Requirements

### Requirement: Cinco botões de criação no toolbar do board
O sistema SHALL exibir cinco botões de criação no toolbar do board, na seguinte ordem da esquerda para a direita: `+ Módulo`, `+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug`. Cada botão abre a modal correspondente ao tipo de item. O botão "+ Módulo" abre uma modal de criação de módulo com campos Nome (obrigatório) e Descrição (opcional).

#### Scenario: Botões exibidos no toolbar
- **WHEN** usuário acessa o board de um projeto
- **THEN** toolbar exibe os cinco botões de criação na ordem: `+ Módulo`, `+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug`

#### Scenario: Criar novo módulo pela toolbar
- **WHEN** usuário clica em `+ Módulo`
- **THEN** modal de criação de módulo abre com campos: Nome (obrigatório), Descrição (opcional)
- **AND** ao confirmar, módulo é criado via `POST /projects/:id/modules` e aparece como swimlane no board se possuir épicos

#### Scenario: Criar novo épico
- **WHEN** usuário clica em `+ Novo Épico`
- **THEN** `EpicModal` abre em modo de criação com campos: Título (obrigatório), Módulo (select obrigatório), Descrição (opcional)
- **AND** ao confirmar, item é criado via `POST /projects/:id/items` com `type = EPIC` e nova swimlane aparece dentro da ModuleSwimlane correspondente

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
O sistema SHALL renderizar o board com a hierarquia visual Módulo >> Épico >> História >> Cards. As swimlanes de Épico SHALL ser aninhadas dentro das ModuleSwimlanes correspondentes.

#### Scenario: Board com múltiplos módulos
- **WHEN** projeto possui 3 módulos com épicos
- **THEN** board exibe 3 ModuleSwimlanes, cada uma contendo as swimlanes de Épico do respectivo módulo

#### Scenario: Épico movido para outro módulo
- **WHEN** épico tem seu `moduleId` alterado via EpicModal
- **THEN** a swimlane do épico é movida para a ModuleSwimlane do novo módulo no board em tempo real
