## ADDED Requirements

### Requirement: Campo tipo em tasks
O sistema SHALL suportar três tipos de card: `TASK` (tarefa padrão), `BUG` (defeito/bug) e `STORY` (história de usuário vinculada à entidade `stories`).

#### Scenario: Badge de tipo visível no card
- **WHEN** um card é exibido no board
- **THEN** um badge com o tipo (`Task`, `Bug`, `Story`) é exibido no rodapé do card, próximo ao badge de prioridade

#### Scenario: Tipo padrão ao criar card pelo formulário rápido
- **WHEN** um card é criado pelo botão "+" na coluna
- **THEN** o tipo padrão é `TASK`; o formulário expõe um seletor de tipo com opções `Task` e `Bug` (Story não é criável pelo formulário rápido)

#### Scenario: Seletor de tipo na modal de edição
- **WHEN** a modal de edição de card é aberta
- **THEN** o campo "Tipo" exibe um select com as opções `Task`, `Bug`, `Story`

#### Scenario: Card do tipo Story abre modal de história
- **WHEN** o usuário clica em um card com tipo `Story`
- **THEN** a modal de edição de história (`StoryModal`) é aberta no lugar da `CardModal`

#### Scenario: Cores diferenciadas por tipo
- **WHEN** o badge de tipo é renderizado
- **THEN** `Task` aparece em azul neutro, `Bug` em vermelho, `Story` em roxo/violeta

### Requirement: Persistência do tipo
O sistema SHALL persistir o campo `type` no banco via coluna `type TEXT NOT NULL DEFAULT 'TASK'` na tabela `tasks`.
