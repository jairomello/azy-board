## MODIFIED Requirements

### Requirement: Fluxo completo de gerenciamento por MCP
O servidor MCP SHALL permitir que um code agent descubra e opere projetos, configurações, estrutura, equipe, planejamento e execução sem precisar montar chamadas REST manualmente. As ferramentas SHALL funcionar em projetos `SIMPLE` e `HIERARCHICAL` respeitando o modo retornado pelo projeto e SHALL aplicar em cada operação as permissões efetivas do Owner da API Key, seu tenant, membership e escopos restritivos.

#### Scenario: Agente descobre projetos disponíveis
- **WHEN** agente invoca `list_projects`
- **THEN** servidor retorna somente projetos permitidos pelo grupo e membership do Owner no tenant, também limitados pelo escopo da API Key, incluindo `id`, `name`, `boardMode` e papel efetivo

#### Scenario: Agente consulta o estado do projeto
- **WHEN** agente invoca `get_project` ou `get_board` com `projectId` autorizado
- **THEN** servidor retorna configuração, colunas, modo, STORY fixa quando aplicável e itens permitidos pelo Owner

#### Scenario: Agente configura projeto completo
- **WHEN** agente invoca ferramentas de projeto, módulos, colunas, sprints, tags, versões, membros, squads ou centros de custo
- **THEN** cada ferramenta verifica o grupo e o papel local do Owner antes de executar, retornando 403 sem mutação quando não autorizado

#### Scenario: Agente executa trabalho
- **WHEN** agente precisa criar, consultar, atualizar, atribuir, mover, ordenar, concluir, arquivar, restaurar ou excluir items
- **THEN** servidor oferece ferramentas específicas com todos os campos suportados, valida o estado e aplica o papel local e o escopo efetivos do Owner

#### Scenario: Upload via IA não está disponível
- **WHEN** agente tenta enviar arquivo ou fazer upload de anexo pelo MCP
- **THEN** servidor informa que upload via IA não é suportado nesta versão e não persiste o conteúdo
