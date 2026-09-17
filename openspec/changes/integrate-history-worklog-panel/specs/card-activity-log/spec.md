## MODIFIED Requirements

### Requirement: Sub-modal de histórico de alterações
O sistema SHALL exibir somente eventos automáticos do card no painel Auditoria de alterações da área Histórico, em ordem cronológica decrescente e com contagem independente do diário. A lista SHALL ser paginada ou carregada incrementalmente e não SHALL apresentar formulário de registrar trabalho.

#### Scenario: Exibir auditoria integrada
- **WHEN** usuário seleciona a área Histórico na `ItemModal`
- **THEN** painel Auditoria lista eventos automáticos com autor/origem, data, hora e descrição, sem abrir uma submodal

#### Scenario: Exibição de cada entrada de log
- **WHEN** lista de logs é renderizada no painel Auditoria
- **THEN** cada entrada exibe autor/origem, data, hora e descrição normalizada

#### Scenario: Carregar mais auditoria
- **WHEN** existem eventos além da página carregada
- **THEN** painel exibe ação Carregar mais com a quantidade restante e acrescenta os eventos sem substituir os já visíveis

#### Scenario: Auditoria sem registros
- **WHEN** card não possui eventos automáticos
- **THEN** painel exibe estado vazio específico de auditoria, sem sugerir que um registro manual seja necessário

#### Scenario: Fechar ou sair da área
- **WHEN** usuário troca de área ou fecha a `ItemModal`
- **THEN** nenhum overlay adicional permanece aberto e o estado da modal principal continua consistente

### Requirement: API de auditoria
O sistema SHALL expor leitura paginada de eventos automáticos com filtros de tenant, projeto e card, sem misturar registros manuais; a nova apresentação inline SHALL consumir esse mesmo contrato.

#### Scenario: Listar logs de uma task
- **WHEN** painel Auditoria chama `GET /projects/:projectId/items/:itemId/audit?page=1&limit=20` por usuário autenticado
- **THEN** API retorna somente eventos `auto`, em ordem decrescente, com `total`, executor e origem

#### Scenario: Isolamento e permissão
- **WHEN** usuário consulta card ou evento fora de seu tenant/projeto
- **THEN** API retorna 404 ou 403 conforme o recurso e não revela dados
