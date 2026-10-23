## Purpose

Definir os requisitos da capacidade story rich editor.

## Requirements

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

### Requirement: Inserir figura na descrição a partir da toolbar
O editor de texto rico SHALL oferecer, na toolbar, uma ação de inserir figura que insere uma imagem na posição do cursor. A ação SHALL permitir escolher entre um arquivo do computador e um anexo de imagem que já está no card, SHALL enviar o arquivo escolhido para os anexos do card no momento da inserção, e SHALL NOT ser oferecida a quem não pode enviar anexos nem em tenant com anexos desabilitados.

#### Scenario: Inserir figura do computador
- **WHEN** o usuário aciona inserir figura e escolhe um arquivo de imagem permitido do seu computador
- **THEN** a imagem é inserida na posição do cursor e o arquivo passa a constar nos anexos do card

#### Scenario: Inserir figura que já está no card
- **WHEN** o usuário aciona inserir figura e escolhe um anexo de imagem que já existe no card
- **THEN** a imagem é inserida na posição do cursor sem novo envio e sem duplicar o anexo

#### Scenario: Ação indisponível sem permissão ou sem anexos habilitados
- **WHEN** o usuário é somente leitura ou a capacidade de anexos está desabilitada no tenant
- **THEN** a ação de inserir figura não é oferecida

#### Scenario: Falha no envio não suja o texto
- **WHEN** o envio do arquivo falha
- **THEN** nenhuma imagem ou marcação inválida é inserida e o usuário recebe o motivo da falha

### Requirement: Colar imagem da área de transferência
O editor SHALL tratar a colagem de uma imagem da área de transferência enviando o arquivo para os anexos do card e inserindo a figura na posição do cursor, sem gravar URL temporária de dados no conteúdo. A colagem SHALL respeitar as mesmas permissões e limites do envio de anexos.

#### Scenario: Colar captura de tela
- **WHEN** o usuário cola uma imagem da área de transferência na descrição
- **THEN** o arquivo é enviado para os anexos do card e a figura aparece na posição do cursor

#### Scenario: Colagem recusada
- **WHEN** a imagem colada excede o limite, tem tipo não permitido, ou o usuário não pode enviar anexos
- **THEN** nada é inserido no texto e o usuário é informado do motivo

#### Scenario: Conteúdo sem URL de dados
- **WHEN** uma imagem é colada
- **THEN** o Markdown resultante referencia o anexo do card, nunca um `data:` em base64

### Requirement: Preservar figura ao editar a descrição
O editor SHALL representar imagens do Markdown, de forma que abrir e salvar uma descrição que já contém figura preserve a figura no conteúdo canônico. Editar outras partes do texto NÃO SHALL remover nem alterar as imagens existentes.

#### Scenario: Editar descrição que já tem figura
- **WHEN** o usuário abre a descrição de um card que contém figura e altera outro trecho do texto
- **THEN** a figura permanece no Markdown salvo, na mesma posição relativa

#### Scenario: Figura escrita fora do editor
- **WHEN** a descrição chega com figura escrita por MCP ou por edição manual do Markdown
- **THEN** o editor a exibe e o salvamento a mantém

#### Scenario: Várias figuras entre parágrafos
- **WHEN** a descrição tem mais de uma figura entre parágrafos
- **THEN** todas permanecem, cada uma em bloco próprio, sem alterar a ordem do texto
