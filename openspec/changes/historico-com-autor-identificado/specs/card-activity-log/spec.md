# Spec Delta

## MODIFIED Requirements

### Requirement: Descrição de auditoria legível e segura
O sistema SHALL exibir descrições automáticas como texto legível, sem tags HTML cruas ou execução de markup não confiável. Cada entrada SHALL identificar o autor do registro de forma inequívoca, sem usar o tipo do executor como nome.

#### Scenario: Alteração em rich text
- **WHEN** auditoria registra alteração de descrição contendo HTML do editor
- **THEN** histórico exibe texto ou diff seguro sem mostrar tags como `<p>` e `<strong>` literalmente

#### Scenario: Origem humano ou agente
- **WHEN** evento foi gerado por usuário, API key, MCP ou sistema
- **THEN** histórico exibe nome/identidade disponível e rótulo de origem correspondente, sem atribuir automaticamente uma operação humana a um robô

#### Scenario: Autor humano resolvido na leitura
- **WHEN** evento automático tem `author_id` de um usuário do tenant
- **THEN** histórico exibe o nome desse usuário como identidade do registro, em vez de um rótulo genérico de tipo

#### Scenario: Autor indisponível tem fallback explícito
- **WHEN** o usuário autor do evento não pode ser resolvido
- **THEN** histórico exibe "Autor não identificado" junto do tipo Humano, preservando data, hora e descrição, sem inventar nome

#### Scenario: Origem desconhecida não é atribuída a humano
- **WHEN** evento tem origem `UNKNOWN` e não há identidade resolvida
- **THEN** histórico exibe o selo Desconhecido e não o trata como registro humano

---

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

#### Scenario: Autor humano aparece como menção
- **WHEN** entrada do histórico tem autor humano identificado
- **THEN** painel exibe a menção `@Nome` em duas partes, com o nome completo acessível por tooltip, e o selo Humano separado

#### Scenario: Registro de agente não vira menção de pessoa
- **WHEN** entrada do histórico foi gerada por agente
- **THEN** painel exibe o rótulo do agente e o selo Agente, sem menção de pessoa, mesmo que o registro tenha autor humano vinculado à API key

---

### Requirement: API de auditoria
O sistema SHALL expor leitura paginada de eventos automáticos com filtros de tenant, projeto e card, sem misturar registros manuais; a nova apresentação inline SHALL consumir esse mesmo contrato. A resposta SHALL resolver o autor do evento a partir do `author_id` quando ele existir.

#### Scenario: Listar logs de uma task
- **WHEN** painel Auditoria chama `GET /projects/:projectId/items/:itemId/audit?page=1&limit=20` por usuário autenticado
- **THEN** API retorna somente eventos `auto`, em ordem decrescente, com `total`, executor e origem

#### Scenario: Isolamento e permissão
- **WHEN** usuário consulta card ou evento fora de seu tenant/projeto
- **THEN** API retorna 404 ou 403 conforme o recurso e não revela dados

#### Scenario: Autor resolvido em qualquer perfil de instalação
- **WHEN** a mesma base de eventos é lida em instalação SIMPLE (SQLite) ou ADVANCED (PostgreSQL)
- **THEN** ambos devolvem `author` com id, nome e avatar quando `author_id` existe, e `author` nulo somente quando não há autor
