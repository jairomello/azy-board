## ADDED Requirements

### Requirement: Hierarquia Épico dentro de Módulo
O sistema SHALL vincular todo épico a um módulo pai. A hierarquia completa é: `Project → Module → Epic → Story → Task`.

#### Scenario: Criação de épico vinculado a módulo
- **WHEN** membro cria um épico selecionando um módulo pai
- **THEN** épico é registrado vinculado ao módulo e aparece nas swimlanes filtradas por aquele módulo

#### Scenario: Épico sem módulo
- **WHEN** projeto não possui módulos criados
- **THEN** sistema usa o módulo padrão "Geral" como pai automático do épico

---

### Requirement: Swimlanes colapsáveis por épico
O sistema SHALL exibir o board com uma raia (swimlane) por épico, contendo todos os cards de tasks folha daquele épico organizados pelas colunas do kanban.

#### Scenario: Colapsar swimlane de épico
- **WHEN** usuário clica no header da swimlane de um épico
- **THEN** raia colapsa, exibindo apenas o título do épico, progresso geral e contagem de cards por coluna

#### Scenario: Expandir swimlane de épico
- **WHEN** usuário clica no header colapsado do épico
- **THEN** raia expande exibindo todos os cards de tasks folha daquele épico nas colunas correspondentes

#### Scenario: Estado de colapso persistido na sessão
- **WHEN** usuário colapsa um épico e navega para outra página e retorna
- **THEN** estado colapsado é mantido durante a mesma sessão do browser

#### Scenario: Progresso do épico no header da swimlane
- **WHEN** swimlane de um épico é exibida (colapsada ou expandida)
- **THEN** header exibe o percentual de progresso calculado com base nas tasks folha descendentes concluídas

---

### Requirement: Raia de Tasks Órfãs
O sistema SHALL exibir uma swimlane especial chamada "Tasks Órfãs" para tasks folha que não estão vinculadas a nenhum épico.

#### Scenario: Task folha sem épico aparece em Tasks Órfãs
- **WHEN** task folha é criada sem story ou épico pai
- **THEN** task aparece na swimlane "Tasks Órfãs" do board

#### Scenario: Task associada a épico sai de Tasks Órfãs
- **WHEN** task órfã é editada e vinculada a uma story/épico
- **THEN** task desaparece de "Tasks Órfãs" e aparece na swimlane do épico em tempo real

---

### Requirement: Histórias como container de tasks dentro do épico
O sistema SHALL suportar Stories como agrupador intermediário entre Épico e Task, visíveis na Tree View e no detalhe do épico, mas não como swimlane separada no Kanban.

#### Scenario: Story agrupa tasks no detalhe do épico
- **WHEN** usuário abre o detalhe de um épico
- **THEN** sistema exibe as stories do épico e as tasks de cada story agrupadas

#### Scenario: Story não gera swimlane própria no Kanban
- **WHEN** board Kanban é exibido
- **THEN** cards de tasks aparecem apenas na swimlane do épico pai, sem subdivisão por story no board

---

### Requirement: Descrição rich text nas Stories
O sistema SHALL fornecer editor rich text (Tiptap, MIT) para o campo de descrição das Stories, com suporte a negrito, itálico, listas, cabeçalhos, links, blocos de código e imagens inline. O conteúdo SHALL ser armazenado como markdown no banco.

#### Scenario: Edição de descrição com formatação visual
- **WHEN** membro abre o detalhe de uma Story para editar a descrição
- **THEN** editor rich text é exibido com toolbar de formatação (negrito, itálico, listas, cabeçalhos, links, código)

#### Scenario: Renderização da descrição formatada
- **WHEN** usuário visualiza o detalhe de uma Story sem estar em modo de edição
- **THEN** descrição é renderizada como HTML formatado a partir do markdown armazenado

#### Scenario: Conteúdo acessível via API como markdown
- **WHEN** agente de IA faz GET da story via API
- **THEN** campo `description` retorna o conteúdo em markdown puro, sem tags HTML
