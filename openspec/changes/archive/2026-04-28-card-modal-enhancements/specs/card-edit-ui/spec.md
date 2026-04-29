## ADDED Requirements

### Requirement: Campo Autor exibido na modal de edição
O sistema SHALL exibir o campo "Autor" na `CardModal` como informação somente leitura, posicionado próximo ao campo "Responsável" para contraste visual entre os dois papéis.

#### Scenario: Autor exibido na modal
- **WHEN** `CardModal` é aberta
- **THEN** campo "Autor" é exibido com avatar e nome do criador (ou "—" se null), sem input de edição

---

### Requirement: Botão "Histórico" na modal do card
O sistema SHALL exibir um botão "Histórico" (com ícone de relógio) no rodapé da `CardModal`, acima da seção de filhos, para acesso ao log de atividades.

#### Scenario: Botão Histórico visível na modal
- **WHEN** `CardModal` é aberta para qualquer task
- **THEN** botão "Histórico" é exibido no rodapé da modal, abaixo dos campos de edição e acima da seção de filhos

#### Scenario: Soma de horas exibida próximo ao botão
- **WHEN** task possui horas registradas em logs manuais
- **THEN** soma no formato "Xh Ym trabalhadas" é exibida ao lado ou abaixo do botão "Histórico"

#### Scenario: Clicar em Histórico abre ActivityLogModal
- **WHEN** usuário clica no botão "Histórico"
- **THEN** `ActivityLogModal` abre sobre a `CardModal` com z-index superior

---

### Requirement: Seção de filhos diretos no rodapé da modal
O sistema SHALL exibir, após o botão "Histórico", uma seção "Subtasks" listando os filhos diretos do card em grid de até 2 colunas.

#### Scenario: Seção Subtasks no rodapé
- **WHEN** `CardModal` é aberta para task com filhos diretos
- **THEN** seção "Subtasks" ocupa o final da modal (após todos os campos e o botão Histórico), com scroll interno se necessário

#### Scenario: Seção Subtasks ausente para tasks folha
- **WHEN** `CardModal` é aberta para task sem filhos
- **THEN** seção "Subtasks" exibe mensagem discreta "Nenhuma subtask" sem expandir a modal desnecessariamente
