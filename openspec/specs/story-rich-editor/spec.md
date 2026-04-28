## ADDED Requirements

### Requirement: Modal de cadastro e edição de história com campos ágeis
O sistema SHALL exibir uma modal (`StoryModal`) para criar e editar histórias, acessível pelo botão "+ Nova história" no toolbar do board e ao clicar em um card do tipo Story.

#### Scenario: Abrir modal de nova história
- **WHEN** o usuário clica em "+ Nova história" no toolbar
- **THEN** a `StoryModal` é aberta em modo de criação com campos vazios

#### Scenario: Abrir modal de edição de história existente
- **WHEN** o usuário clica em um card do tipo Story no board
- **THEN** a `StoryModal` é aberta em modo de edição com os dados da história preenchidos

#### Scenario: Campos ágeis padrão
- **WHEN** a `StoryModal` é exibida
- **THEN** contém os campos: Título, Épico (select), "Como [persona]", "Eu quero [ação]", "Para que [benefício]", Critérios de Aceitação (rich text), Notas (rich text)

#### Scenario: Editor rich text com toolbar de formatação
- **WHEN** o usuário foca em um campo de rich text (Critérios de Aceitação ou Notas)
- **THEN** uma toolbar é exibida com botões: Negrito, Itálico, H1, H2, H3, Lista com marcadores, Lista numerada, Tabela, Link
- **AND** ao clicar em um botão da toolbar, a formatação é aplicada ao texto selecionado ou à posição do cursor

#### Scenario: Salvar história
- **WHEN** o usuário clica em "Salvar"
- **THEN** sistema chama `POST /projects/:id/stories` (criação) ou `PATCH /projects/:id/stories/:storyId` (edição) com todos os campos, incluindo o HTML gerado pelo editor
- **AND** a modal fecha e a lista de histórias é atualizada

#### Scenario: Cancelar criação/edição
- **WHEN** o usuário clica em "Cancelar" ou pressiona Escape
- **THEN** a modal fecha sem salvar alterações

### Requirement: Toolbar do editor Tiptap
O componente `<RichTextEditor>` SHALL incluir os botões de formatação acessíveis acima da área de edição.

#### Scenario: Botão de formatação ativo
- **WHEN** o cursor está em um trecho com formatação aplicada (ex: negrito)
- **THEN** o botão correspondente na toolbar aparece em estado ativo/destacado
