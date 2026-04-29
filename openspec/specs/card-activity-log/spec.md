## ADDED Requirements

### Requirement: Registro automático de logs para ações no card
O sistema SHALL gerar automaticamente um log de atividade toda vez que uma alteração relevante ocorrer em uma task, sem intervenção do usuário.

#### Scenario: Log gerado ao editar dados do card
- **WHEN** usuário ou agente salva alterações em campos do card (título, descrição, prioridade, responsável, tags, pontos, datas)
- **THEN** log automático é criado com: `type = 'auto'`, `author_id` do executor, `activity` descrevendo os campos alterados (ex: "Título alterado de 'X' para 'Y'"), `created_at` atual, `duration_min = null`

#### Scenario: Log gerado ao mover card de coluna
- **WHEN** usuário move card para outra coluna no Kanban (drag-and-drop ou API)
- **THEN** log automático é criado com `activity` no formato "Movido de '[Coluna Origem]' para '[Coluna Destino]'"

#### Scenario: Log automático não é editável
- **WHEN** usuário tenta editar um log com `type = 'auto'` via API `PATCH /tasks/:id/logs/:logId`
- **THEN** API retorna 403 Forbidden com mensagem "Logs automáticos não podem ser editados"

---

### Requirement: Registro manual de log de atividade pelo usuário
O sistema SHALL permitir que membros registrem manualmente logs de progresso em um card, incluindo descrição livre e tempo trabalhado em minutos.

#### Scenario: Criar log manual com duração
- **WHEN** membro preenche o formulário de log manual com `activity` e `duration_min` e confirma
- **THEN** log é criado com `type = 'manual'`, `author_id` do membro, `activity` informado e `duration_min` informado

#### Scenario: Criar log manual sem duração
- **WHEN** membro preenche log manual apenas com `activity` (sem informar duração)
- **THEN** log é criado com `duration_min = null` sem erro de validação

#### Scenario: Editar log manual próprio
- **WHEN** membro edita um log manual que ele mesmo criou via `PATCH /tasks/:id/logs/:logId`
- **THEN** campos `activity` e `duration_min` são atualizados e `updated_at` é renovado

#### Scenario: ADMIN pode editar qualquer log manual
- **WHEN** usuário com papel ADMIN edita log manual de outro membro
- **THEN** alteração é aceita normalmente

#### Scenario: Membro não pode editar log de outro membro
- **WHEN** membro tenta editar log manual criado por outro usuário
- **THEN** API retorna 403 Forbidden

---

### Requirement: Soma de horas trabalhadas exibida na modal
O sistema SHALL calcular e exibir o total de horas trabalhadas (soma de `duration_min` dos logs manuais) na `CardModal`.

#### Scenario: Task com logs manuais com duração
- **WHEN** `CardModal` é aberta para task com ao menos um log manual com `duration_min > 0`
- **THEN** modal exibe "X h Ym trabalhadas" (ex: "3 h 30 min trabalhadas") abaixo do botão "Histórico"

#### Scenario: Task sem logs manuais com duração
- **WHEN** `CardModal` é aberta para task sem nenhum log manual com duração
- **THEN** campo de horas não é exibido (ausência de informação, não zero)

---

### Requirement: Sub-modal de histórico de atividades
O sistema SHALL exibir os logs de atividade de um card em uma sub-modal ("Histórico") aberta sobre a `CardModal`, sem poluir a modal principal.

#### Scenario: Abrir sub-modal de histórico
- **WHEN** usuário clica no botão "Histórico" na `CardModal`
- **THEN** `ActivityLogModal` abre sobre a modal do card com: título da task, ID, lista de logs (automáticos e manuais em ordem cronológica decrescente) e botão "+ Registrar"

#### Scenario: Exibição de cada entrada de log
- **WHEN** lista de logs é renderizada na `ActivityLogModal`
- **THEN** cada entrada exibe: avatar + nome do autor, data e hora, descrição da atividade, duração (se existir), ícone diferenciando auto (🤖) de manual (✏️)

#### Scenario: Ícone de lápis apenas em logs manuais
- **WHEN** log na lista tem `type = 'manual'` e o usuário logado é o autor (ou ADMIN)
- **THEN** ícone de lápis (editar) é exibido ao lado da entrada; logs `auto` não exibem esse ícone

#### Scenario: Paginação da lista de logs
- **WHEN** task possui mais de 20 logs
- **THEN** lista exibe os 20 mais recentes com botão "Carregar mais" para paginar

#### Scenario: Fechar sub-modal de histórico
- **WHEN** usuário clica em "✕" ou pressiona Escape na `ActivityLogModal`
- **THEN** sub-modal fecha e a `CardModal` pai volta ao foco sem recarregar

---

### Requirement: API de logs de atividade
O sistema SHALL expor endpoints REST para leitura e escrita de logs, respeitando tenant e permissões RBAC.

#### Scenario: Listar logs de uma task
- **WHEN** `GET /projects/:projectId/tasks/:taskId/logs?page=1&limit=20` é chamado por membro autenticado
- **THEN** API retorna logs em ordem decrescente de `created_at` com paginação

#### Scenario: Criar log manual
- **WHEN** `POST /projects/:projectId/tasks/:taskId/logs` com `{ activity, duration_min? }` é chamado
- **THEN** log é criado com `type = 'manual'` e `author_id` do usuário autenticado

#### Scenario: Editar log manual
- **WHEN** `PATCH /projects/:projectId/tasks/:taskId/logs/:logId` com campos atualizados é chamado
- **THEN** se `type = 'auto'`, retorna 403; se `type = 'manual'` e usuário é autor ou ADMIN, atualiza e retorna 200

#### Scenario: VIEWER não pode criar nem editar logs
- **WHEN** usuário com papel VIEWER tenta `POST` ou `PATCH` em logs
- **THEN** API retorna 403 Forbidden
