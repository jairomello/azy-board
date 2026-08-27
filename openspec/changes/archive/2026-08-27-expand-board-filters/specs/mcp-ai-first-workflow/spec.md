## MODIFIED Requirements

### Requirement: Fluxo completo de gerenciamento por MCP
O servidor MCP SHALL permitir que um code agent descubra e opere projetos, configurações, estrutura, equipe, planejamento e execução sem precisar montar chamadas REST manualmente. As ferramentas SHALL funcionar em projetos `SIMPLE` e `HIERARCHICAL` respeitando o modo retornado pelo projeto. A ferramenta `create_task` SHALL aceitar `versionId` opcional e preservar o vínculo de versão informado.

#### Scenario: Agente descobre projetos disponíveis
- **WHEN** agente invoca `list_projects`
- **THEN** servidor retorna somente projetos do tenant e com membership do Owner da API Key, incluindo `id`, `name`, `boardMode` e papel efetivo

#### Scenario: Agente consulta o estado do projeto
- **WHEN** agente invoca `get_project` ou `get_board` com `projectId`
- **THEN** servidor retorna configuração, colunas, modo, STORY fixa quando aplicável e itens em formato estruturado adequado para planejamento

#### Scenario: Agente configura projeto completo
- **WHEN** agente invoca ferramentas de projeto, módulos, colunas, sprints, tags, versões, membros, squads ou centros de custo
- **THEN** cada ferramenta executa a operação correspondente, retorna o recurso atualizado e aplica as permissões do Owner

#### Scenario: Agente cria item versionado
- **WHEN** agente invoca `create_task` com `versionId` pertencente ao projeto
- **THEN** servidor cria TASK/BUG com o vínculo de versão e retorna o item atualizado

#### Scenario: Agente cria item sem versão
- **WHEN** agente invoca `create_task` sem `versionId`
- **THEN** servidor cria o item normalmente sem vínculo de versão

#### Scenario: Versão inválida na criação
- **WHEN** agente invoca `create_task` com `versionId` de outro projeto ou tenant
- **THEN** servidor rejeita a chamada antes de criar o item

#### Scenario: Agente executa trabalho
- **WHEN** agente precisa criar, consultar, atualizar, atribuir, mover, ordenar, concluir, arquivar, restaurar ou excluir items
- **THEN** servidor oferece ferramentas específicas com todos os campos suportados, valida o estado e retorna resultado acionável

#### Scenario: Upload via IA não está disponível
- **WHEN** agente tenta enviar arquivo ou fazer upload de anexo pelo MCP
- **THEN** servidor informa que upload via IA não é suportado nesta versão e não persiste o conteúdo
