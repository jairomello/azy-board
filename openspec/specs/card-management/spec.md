## Purpose

Definir os requisitos da capacidade card management.
## Requirements
### Requirement: CRUD completo de cards (tasks folha)
O sistema SHALL permitir criar, visualizar, editar e excluir cards. Apenas tasks folha (sem filhos) são exibidas como cards móveis no Kanban. Campos: título, descrição (markdown), labels, prioridade (LOW | MEDIUM | HIGH | CRITICAL), responsável, story pai, tags, pontos (inteiro, opcional), status, sprint, versão, centro de custo e datas de início/fim quando disponíveis. A visualização e edição de TASK/BUG SHALL usar um modal amplo e responsivo com cabeçalho contextual, navegação entre Detalhes, Subtasks, Checklists e Histórico, conteúdo principal e painel de propriedades.

#### Scenario: Abrir edição de card
- **WHEN** membro clica em um card de TASK ou BUG
- **THEN** sistema abre o modal amplo sobre o board, mostra o contexto do item no cabeçalho, mantém propriedades acessíveis no painel e inicia em Detalhes

#### Scenario: Visualizar descrição e propriedades
- **WHEN** usuário abre Detalhes
- **THEN** descrição rica e campos de relacionamento ficam na área principal, enquanto status, responsável, prioridade, planejamento e informações ficam no painel de propriedades sem alterar seus valores

#### Scenario: Alternar áreas sem perder edição
- **WHEN** usuário edita um campo, alterna para Subtasks, Checklists ou Histórico e retorna a Detalhes
- **THEN** valor não salvo permanece no estado local da modal e pode ser salvo posteriormente

#### Scenario: Editar card
- **WHEN** membro edita campos do card e confirma em Salvar alterações
- **THEN** alterações são enviadas pelo contrato de atualização existente, o modal fecha após sucesso e mudanças são propagadas em tempo real para todos os usuários no board

#### Scenario: Cancelar edição
- **WHEN** usuário clica em Cancelar, no X, no backdrop ou pressiona Escape
- **THEN** modal fecha sem persistir alterações locais, respeitando o fechamento do nível superior quando houver modal filha

#### Scenario: Responsividade do modal
- **WHEN** usuário abre o modal em viewport desktop ou mobile
- **THEN** desktop mostra conteúdo e propriedades em duas áreas; mobile empilha ou colapsa essas áreas, mantém ações acessíveis e não exige rolagem horizontal

#### Scenario: Preservar recursos relacionados
- **WHEN** usuário abre Subtasks, Checklists ou Histórico
- **THEN** sistema mantém as listas, contagens, estados vazios, ações de criação/edição e APIs existentes, sem bloquear o salvamento dos campos principais quando uma consulta auxiliar falha

#### Scenario: Exclusão de card
- **WHEN** membro com perfil MEMBER ou superior exclui card
- **THEN** card é removido do board e do banco; se a task excluída era o último filho de uma task pai, a task pai volta a ser folha e reaparece no Kanban

### Requirement: Breadcrumb dinâmico exibido no card
O sistema SHALL exibir em cada card o caminho hierárquico completo abaixo do título: `Projeto > Módulo > Épico > Story > Task Pai > ... > Task Atual`.

#### Scenario: Breadcrumb truncado por espaço
- **WHEN** breadcrumb completo ultrapassa o espaço disponível no card
- **THEN** caminho é exibido truncado com reticências no meio (ex: `Projeto > Módulo > ... > Task Atual`)

#### Scenario: Hover expande breadcrumb completo
- **WHEN** usuário passa o mouse sobre o breadcrumb truncado
- **THEN** tooltip ou popover exibe o caminho completo com links clicáveis para cada nível

---

### Requirement: Tags no card
O sistema SHALL exibir as tags associadas ao card como chips coloridos e permitir adicionar ou remover tags diretamente no card ou no modal de edição.

#### Scenario: Chips de tags no card
- **WHEN** card possui tags associadas
- **THEN** chips com nome e cor das tags são exibidos no card (área de rodapé ou abaixo do breadcrumb)

#### Scenario: Adicionar tag ao card via modal
- **WHEN** membro abre modal de edição e seleciona tags do catálogo do projeto
- **THEN** tags são adicionadas ao card e chips aparecem imediatamente

---

### Requirement: Movimentação de cards por drag-and-drop (apenas tasks folha)
O sistema SHALL permitir arrastar apenas cards de tasks folha entre colunas. O status base SHALL ser atualizado automaticamente conforme o mapeamento da coluna destino.

#### Scenario: Mover card folha para outra coluna
- **WHEN** usuário arrasta card de task folha para nova coluna
- **THEN** card muda de coluna, status é atualizado para o status base da coluna destino, e todos os participantes veem a mudança em tempo real

#### Scenario: Task pai bloqueada para drag-and-drop
- **WHEN** usuário tenta arrastar card de task pai (com filhos)
- **THEN** sistema bloqueia o drag e exibe tooltip "Esta task possui subtasks — mova as subtasks individualmente"

---

### Requirement: Sistema de claim de tasks
O sistema SHALL permitir que um usuário (humano ou agente de IA) reivindique uma task folha para si.

#### Scenario: Claim de task disponível
- **WHEN** usuário ou agente faz claim de task com status NOT_STARTED
- **THEN** task é atribuída ao claimante, status muda para IN_PROGRESS e card mostra o responsável

#### Scenario: Tentativa de claim em task já atribuída
- **WHEN** segundo usuário tenta fazer claim de task já atribuída
- **THEN** sistema retorna erro 409 com informação de quem está com a task

#### Scenario: Release de claim
- **WHEN** responsável libera o claim da task
- **THEN** task volta para NOT_STARTED sem responsável atribuído

---

### Requirement: Toggle de visibilidade de subtasks no Kanban
O sistema SHALL oferecer um toggle no board para exibir ou ocultar subtasks com comportamento correto da Leaf Rule.

#### Scenario: Toggle desativado (padrão) — sem subtasks
- **WHEN** toggle "Mostrar subtasks" está desativado (estado padrão)
- **THEN** board exibe apenas tasks do primeiro nível — tasks que NÃO possuem `parentId` — independente de terem filhos ou não; subtasks ficam ocultas

#### Scenario: Toggle ativado — apenas tasks folha (Leaf Rule)
- **WHEN** usuário ativa o toggle "Mostrar subtasks"
- **THEN** board aplica a Leaf Rule e exibe apenas tasks folha (tasks que não são `parentId` de nenhuma outra task carregada); tasks pai com subtasks ficam ocultas e apenas suas folhas aparecem

#### Scenario: Frase de aviso removida dos cards
- **WHEN** qualquer card é exibido no board
- **THEN** a frase "Esta task possui subtasks — mova as subtasks individualmente" NÃO aparece visível ao usuário; o bloqueio de drag em tasks pai é silencioso (cursor not-allowed sem texto)

---

### Requirement: Status base das tasks
O sistema SHALL manter o status base: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`.

#### Scenario: Task bloqueada
- **WHEN** membro marca task como BLOCKED
- **THEN** card exibe indicador visual de bloqueio e pode receber descrição do bloqueio

#### Scenario: Task cancelada
- **WHEN** admin cancela task
- **THEN** card fica visível no board com indicador de cancelado e não pode receber novas atribuições

---

### Requirement: Pontuação no card
O sistema SHALL exibir o campo de pontos no card e no modal de edição. Pontos são opcionais (nullable). Para tasks folha, o valor é editável diretamente. Para tasks pai, o valor exibido é a soma calculada (somente leitura).

#### Scenario: Editar pontos de task folha
- **WHEN** membro edita o campo de pontos no modal do card
- **THEN** valor é salvo e a soma de pontos dos ancestrais é atualizada em tempo real

#### Scenario: Pontos de task pai são somente leitura
- **WHEN** usuário tenta editar o campo de pontos de uma task pai
- **THEN** campo está desabilitado com tooltip indicando que o valor é calculado a partir das subtasks

#### Scenario: Pontos exibidos no card
- **WHEN** card com pontos atribuídos é exibido no Kanban
- **THEN** badge com o valor de pontos é exibido no card (ex: "5 pts")

---

### Requirement: Proteção anti-IDOR em cards
O sistema SHALL verificar server-side se o usuário tem membership no projeto do card antes de retornar ou modificar qualquer dado.

#### Scenario: Acesso a card de projeto não autorizado
- **WHEN** usuário tenta acessar card via API com ID manipulado sem ter membership no projeto
- **THEN** sistema retorna 404 sem revelar existência do recurso

---

### Requirement: Persistência do autor na criação de tasks
O sistema SHALL capturar e persistir o `author_id` no momento da criação de qualquer task, utilizando o identificador do usuário ou agente autenticado extraído do middleware.

#### Scenario: author_id preenchido automaticamente na criação
- **WHEN** `POST /projects/:id/tasks` é chamado com payload válido
- **THEN** backend preenche `author_id` com o `userId` do JWT (ou `agentId` da API Key) antes de inserir no banco, sem exigir o campo no body da requisição

#### Scenario: author_id não pode ser alterado via PATCH
- **WHEN** `PATCH /projects/:projectId/tasks/:taskId` inclui `author_id` no body
- **THEN** campo `author_id` é silenciosamente ignorado na atualização (não retorna erro, mas não altera o valor)

---

### Requirement: Geração de log automático ao atualizar task
O sistema SHALL gerar um log automático sempre que campos relevantes de uma task forem alterados via API.

#### Scenario: Log automático gerado em PATCH de task
- **WHEN** `PATCH /projects/:projectId/tasks/:taskId` altera título, descrição, prioridade, responsável, tags, pontos ou datas
- **THEN** registro em `task_logs` é criado com `type = 'auto'`, `author_id` do solicitante, `activity` descrevendo mudanças (campos alterados com valor anterior → novo)

#### Scenario: PATCH sem alteração real não gera log
- **WHEN** `PATCH` é chamado com payload idêntico ao estado atual da task
- **THEN** nenhum log é gerado

---

### Requirement: Geração de log automático ao mover task de coluna
O sistema SHALL gerar um log automático quando uma task é movida para outra coluna, seja via drag-and-drop ou API direta.

#### Scenario: Log de movimentação gerado
- **WHEN** status/coluna de uma task é alterado (via `PATCH` ou endpoint de movimentação)
- **THEN** log automático é criado com `activity = "Movido de '[Nome Coluna Origem]' para '[Nome Coluna Destino]'"`

### Requirement: Exibição do sequenceCode no card do Kanban
O sistema SHALL exibir o `sequenceCode` do item no card do Kanban, substituindo o UUID truncado quando disponível.

#### Scenario: Card com sequenceCode exibe o código
- **WHEN** card possui `sequenceCode` não nulo (ex: "T3")
- **THEN** o código é exibido na área de identificação do card (ao lado do badge de tipo), substituindo o UUID truncado

#### Scenario: Card sem sequenceCode exibe UUID truncado
- **WHEN** card possui `sequenceCode` nulo
- **THEN** o card exibe o UUID truncado (primeiros 8 caracteres) como fallback, mantendo o comportamento atual

#### Scenario: Código atualizado em tempo real
- **WHEN** um item tem seu `sequenceCode` alterado via API
- **THEN** o card no Kanban atualiza o código exibido via WebSocket broadcast

