# Spec Delta

## MODIFIED Requirements

### Requirement: CRUD completo de cards (tasks folha)

O sistema SHALL permitir criar, visualizar, editar e excluir cards. Apenas tasks folha (sem filhos) são exibidas como cards móveis no Kanban. Campos: título, descrição (markdown), labels, prioridade (LOW | MEDIUM | HIGH | CRITICAL), responsável, **responsável externo (`assigneeLabel`)**, story pai, tags, pontos (inteiro, opcional), status, sprint, versão, centro de custo, datas de início/fim, **datas realizadas (`actualStartDate`/`actualDueDate`)**, **datas baseline (`baselineStartDate`/`baselineDueDate`)**, **chave externa (`externalSource`/`externalRef`)** e os campos opcionais de aparência `icon` (nome no catálogo de ícones) e `color` (hex da paleta). A visualização e edição de TASK/BUG SHALL usar um modal amplo e responsivo com cabeçalho contextual, navegação entre Detalhes, Subtasks, Checklists e Histórico, conteúdo principal e painel de propriedades.

#### Scenario: Abrir edição de card
- **WHEN** membro clica em um card de TASK ou BUG
- **THEN** sistema abre o modal amplo sobre o board, mostra o contexto do item no cabeçalho, mantém propriedades acessíveis no painel e inicia em Detalhes

#### Scenario: Visualizar descrição e propriedades
- **WHEN** usuário abre Detalhes
- **THEN** descrição rica e campos de relacionamento ficam na área principal, enquanto status, responsável, prioridade, planejamento, datas de acompanhamento e informações ficam no painel de propriedades sem alterar seus valores

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

#### Scenario: Editar aparência do card
- **WHEN** membro altera ícone ou cor do card
- **THEN** a alteração é persistida e refletida no board, na árvore e nas listagens

## ADDED Requirements

### Requirement: Criação de card com status explícito ou herdado da coluna

O sistema SHALL honrar o `status` informado na criação de um item. Quando o `status` não for informado e houver `columnId`, o sistema SHALL herdar o `baseStatus` da coluna. Quando nenhum dos dois for informado, o item SHALL nascer em `NOT_STARTED`. O `blockedReason` SHALL ser aceito na criação.

#### Scenario: Status explícito
- **WHEN** um membro cria um item com `status: "IN_PROGRESS"`
- **THEN** o item é persistido em `IN_PROGRESS`, independentemente da coluna informada

#### Scenario: Status herdado da coluna
- **WHEN** um membro cria um item com uma coluna cujo `baseStatus` é `DONE` e não informa `status`
- **THEN** o item é persistido em `DONE`

#### Scenario: Sem status e sem coluna
- **WHEN** um membro cria um item sem `status` e sem `columnId`
- **THEN** o item é persistido em `NOT_STARTED`

#### Scenario: Item bloqueado na criação
- **WHEN** um membro cria um item com `status: "BLOCKED"` e `blockedReason`
- **THEN** o item é persistido com o motivo e aparece como bloqueado no board

### Requirement: Responsável externo e datas de acompanhamento

O sistema SHALL permitir registrar um responsável externo em texto livre (`assigneeLabel`) sem criar conta de usuário, e SHALL permitir registrar datas realizadas e baseline separadas das datas previstas. O `assigneeLabel` NÃO SHALL substituir `assigneeId`: quando houver usuário, o usuário é o responsável; o label é informação complementar.

#### Scenario: Responsável externo
- **WHEN** um membro informa `assigneeLabel: "Infra Vivo"` em um item sem usuário responsável
- **THEN** o card mostra o label como responsável e o item continua sem `assigneeId`

#### Scenario: Datas realizadas e baseline
- **WHEN** um membro informa `actualStartDate`, `actualDueDate`, `baselineStartDate` e `baselineDueDate`
- **THEN** os quatro valores são persistidos e exibidos separadamente das datas previstas

#### Scenario: Datas incoerentes
- **WHEN** um membro informa uma data final realizada anterior à inicial realizada, ou um baseline final anterior ao inicial
- **THEN** o sistema recusa com erro de validação e não persiste o par incoerente

### Requirement: Filtro por chave externa

O sistema SHALL permitir filtrar a listagem de itens por `externalSource` e/ou `externalRef`, combinando com os filtros existentes e respeitando o tenant e o projeto.

#### Scenario: Encontrar item pela chave
- **WHEN** um membro lista itens com `externalSource=planilha` e `externalRef=<chave>`
- **THEN** a resposta contém somente o item correspondente do projeto

#### Scenario: Chave inexistente
- **WHEN** o filtro não encontra correspondência
- **THEN** a resposta é uma lista vazia, sem erro
