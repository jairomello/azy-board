## Why

A modal de edição de cards concentra a maior parte da interação do usuário com o sistema, mas atualmente carece de três capacidades essenciais para rastreabilidade e navegação: visualização imediata dos cards filhos, identificação do autor original do card e histórico de atividades. Sem esses recursos, times não conseguem auditar o trabalho realizado nem navegar eficientemente na hierarquia de tarefas a partir da modal.

## What Changes

- **Seção de cards filhos na modal**: exibe os filhos diretos do card aberto como mini-cards em grid de duas colunas no final da modal. Clicar em um filho abre a modal daquele card empilhada sobre a atual (stack de modais).
- **Campo autor do card**: novo campo somente leitura (preenchido automaticamente no momento da criação) que identifica quem criou o card — distinto do campo "responsável" (assignee).
- **Sistema de logs de atividade**: logs automáticos gerados pelo sistema para toda alteração relevante (editar dados, mover coluna) e logs manuais inseridos por humanos para registrar progresso, descrição livre e horas trabalhadas. Acessível via botão "Histórico" na modal, que abre uma sub-modal sobre a modal do card. A soma de horas dos logs manuais é exibida no card.

## Capabilities

### New Capabilities

- `card-children-section`: seção na modal do card que lista os filhos diretos em grid, permitindo navegação por empilhamento de modais
- `card-author`: campo de autoria do card (quem criou), persistido na criação e exibido na modal como campo somente leitura
- `card-activity-log`: sistema de logs de atividade com registros automáticos (alterações e movimentações) e manuais (progresso livre + horas trabalhadas), acessível via sub-modal "Histórico"

### Modified Capabilities

- `card-edit-ui`: a modal de edição recebe o campo autor (leitura), a seção de filhos no rodapé e o botão "Histórico" que abre a sub-modal de logs
- `card-management`: criação e atualização de cards passa a persistir e retornar o campo `author_id`; API de cards expõe endpoint de logs

## Impact

- **Frontend**: `CardModal` ganha três novas seções/comportamentos; novo componente `CardChildrenSection`; novo componente `ActivityLogModal`; stack de modais via contexto ou array de estados
- **Backend/API**: tabela `task_logs` nova; campo `author_id` em `tasks`; endpoints `GET /tasks/:id/children` (filhos diretos), `GET /tasks/:id/logs`, `POST /tasks/:id/logs`, `PATCH /tasks/:id/logs/:logId`; trigger automático de log em operações de escrita existentes
- **Banco de dados**: migration adicionando `author_id` em `tasks` e criando tabela `task_logs`
- **Sem breaking changes**: campo `author_id` opcional para tasks existentes (retroativo: null); nenhum campo existente é removido ou renomeado
