## MODIFIED Requirements

### Requirement: Modal de edição de card organizada em accordions
O sistema SHALL apresentar campos do card, descrição, subtasks, checklists e Histórico em áreas independentes, preservando edição, criação, abertura de filhos e salvamento. A área Histórico SHALL exibir diretamente dois painéis independentes: Auditoria de alterações e Diário de trabalho. O painel de Auditoria SHALL listar eventos automáticos; o painel de Diário SHALL listar registros manuais, totalizar duração e oferecer formulário inline para novo registro. A modal SHALL manter título, descrição rich text (Tiptap), prioridade, responsável, story pai, tags, pontos, data de início e data de fim.

#### Scenario: Seções independentes
- **WHEN** usuário abre a área Histórico de uma Task, Bug ou Subtask
- **THEN** Auditoria de alterações e Diário de trabalho aparecem simultaneamente em painéis distintos, sem misturar logs, horas ou ações

#### Scenario: Estado inicial com listas vazias
- **WHEN** card não possui eventos automáticos nem registros manuais
- **THEN** a área Histórico mostra estados vazios explicativos nos dois painéis e uma ação visível para registrar trabalho, sem abrir outra modal

#### Scenario: Contagens e totalização
- **WHEN** card possui eventos automáticos ou registros manuais
- **THEN** cada painel mostra somente sua própria contagem, e o Diário mostra o total de duração sem incluir auditoria automática

#### Scenario: Salvar edições pela modal
- **WHEN** usuário altera campos e clica em Salvar
- **THEN** todas as alterações são enviadas via API e o card no board atualiza em tempo real

#### Scenario: Fechar modal sem salvar
- **WHEN** usuário clica em Cancelar ou pressiona Escape fora de um editor de diário ativo
- **THEN** modal fecha sem persistir alterações, inclusive alterações feitas em outras áreas

#### Scenario: Criar subtask pela modal
- **WHEN** usuário clica em Adicionar subtask dentro da modal
- **THEN** formulário de criação de subtask é exibido vinculado ao card atual como pai

#### Scenario: Selecionar tags na modal
- **WHEN** usuário clica no seletor de tags dentro da modal
- **THEN** dropdown exibe todas as tags do projeto com chips coloridos; usuário pode selecionar e desselecionar múltiplas tags

### Requirement: Botão "Histórico" na modal do card
O sistema SHALL exibir a área Histórico na navegação da `ItemModal`, com ícone, contagem de eventos automáticos e acesso direto ao conteúdo integrado. A área NÃO SHALL abrir `ActivityLogModal` ou `WorkLogModal` para exibir listas ou cadastrar trabalho.

#### Scenario: Abrir Histórico integrado
- **WHEN** usuário seleciona a guia Histórico da modal
- **THEN** Auditoria e Diário de trabalho são renderizados dentro da própria modal, com seus cabeçalhos e ações

#### Scenario: Soma de horas exibida no Diário
- **WHEN** task possui horas registradas em logs manuais
- **THEN** soma no formato de horas e minutos trabalhados é exibida no painel Diário de trabalho

#### Scenario: Registrar trabalho sem submodal
- **WHEN** usuário aciona Registrar trabalho no painel Diário
- **THEN** formulário inline aparece no próprio painel e a modal principal permanece aberta
