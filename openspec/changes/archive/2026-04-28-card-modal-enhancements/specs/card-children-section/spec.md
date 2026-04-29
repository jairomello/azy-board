## ADDED Requirements

### Requirement: Seção de filhos diretos na modal do card
O sistema SHALL exibir, no final da `CardModal`, uma seção "Subtasks" listando apenas os filhos diretos (nível imediatamente abaixo) da task aberta. Netos e demais descendentes NÃO são exibidos aqui — apenas no ícone de contador de filhos no card do Kanban.

#### Scenario: Modal de task com filhos diretos
- **WHEN** `CardModal` é aberta para uma task que possui filhos diretos
- **THEN** seção "Subtasks" é exibida no final da modal com os cards filhos em grid de no máximo 2 colunas (responsivo: 1 coluna em telas estreitas)

#### Scenario: Modal de task sem filhos
- **WHEN** `CardModal` é aberta para uma task folha (sem filhos)
- **THEN** seção "Subtasks" exibe mensagem "Nenhuma subtask criada" sem ocupar espaço visual excessivo

#### Scenario: Exibição mínima de cada card filho
- **WHEN** seção "Subtasks" é renderizada
- **THEN** cada filho exibe: título, tipo (ícone), prioridade (cor/badge), responsável (avatar) e status (badge de coluna)

---

### Requirement: Navegação por empilhamento de modais ao clicar em filho
O sistema SHALL abrir a `CardModal` do card filho sobre a modal atual (stack de modais) ao invés de fechar e reabrir.

#### Scenario: Clicar em um card filho
- **WHEN** usuário clica em um card filho na seção "Subtasks"
- **THEN** `CardModal` do filho é aberta sobre a modal atual, com overlay de fundo escurecido adicional e `z-index` superior ao da modal pai

#### Scenario: Voltar para a modal pai
- **WHEN** modal do filho está aberta sobre a modal pai e usuário clica no botão "← Voltar" ou pressiona Escape
- **THEN** modal do filho é fechada e a modal do pai volta ao foco sem recarregar dados

#### Scenario: Fechar toda a pilha de modais
- **WHEN** usuário clica no botão "✕ Fechar" (não o "← Voltar") em qualquer modal da pilha
- **THEN** toda a pilha de modais é fechada de uma vez

#### Scenario: Limite de profundidade da pilha
- **WHEN** usuário tenta abrir um 6º nível de modal na pilha
- **THEN** ao invés de empilhar, o sistema substitui a modal do topo pelo novo card, mantendo os níveis anteriores intactos

---

### Requirement: Carregamento dos filhos diretos via API
O sistema SHALL fornecer endpoint para buscar filhos diretos de uma task, respeitando tenant e permissões.

#### Scenario: Buscar filhos diretos com sucesso
- **WHEN** `GET /projects/:projectId/tasks/:taskId/children` é chamado por usuário autenticado com acesso ao projeto
- **THEN** API retorna array de tasks com `parent_id === taskId`, incluindo campos para renderização do mini-card, com paginação opcional

#### Scenario: Task sem filhos
- **WHEN** `GET /projects/:projectId/tasks/:taskId/children` é chamado para task folha
- **THEN** API retorna `{ data: [], total: 0 }`

#### Scenario: Acesso negado sem autorização
- **WHEN** usuário sem acesso ao projeto chama o endpoint de filhos
- **THEN** API retorna 403 Forbidden
