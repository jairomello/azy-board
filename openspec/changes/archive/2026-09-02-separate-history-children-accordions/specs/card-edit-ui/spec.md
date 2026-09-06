## MODIFIED Requirements

### Requirement: Seção de filhos diretos no rodapé da modal
O sistema SHALL exibir, após o botão "Histórico", uma seção independente "Subtasks" listando os filhos diretos do card em grid de até 2 colunas. A seção SHALL estar em accordion próprio, separado do accordion de Histórico/Atividades, com ações e resumo de filhos independentes.

#### Scenario: Seção Subtasks no rodapé
- **WHEN** `CardModal` é aberta para task com filhos diretos
- **THEN** seção "Subtasks" ocupa o final da modal em accordion separado, após todos os campos e o botão Histórico, com scroll interno se necessário

#### Scenario: Seção Subtasks ausente para tasks folha
- **WHEN** `CardModal` é aberta para task sem filhos diretos
- **THEN** seção "Subtasks" exibe mensagem discreta "Nenhuma subtask" sem expandir a modal desnecessariamente

#### Scenario: Histórico não é misturado aos filhos
- **WHEN** usuário expande ou recolhe Histórico
- **THEN** a seção Subtasks mantém seu próprio estado e não exibe logs, horas ou atividades
