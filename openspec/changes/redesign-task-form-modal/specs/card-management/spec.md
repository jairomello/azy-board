## MODIFIED Requirements

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
