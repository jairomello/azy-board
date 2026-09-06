## MODIFIED Requirements

### Requirement: Escopo de projetos por grupo
O sistema SHALL permitir que Membros de Equipe e Gerentes visualizem somente projetos com membership ativa, SHALL permitir que Admins visualizem os projetos do tenant ativo **exceto** os projetos restritos nos quais não possuam membership nem sejam indicados como Gerente Geral, e SHALL conceder ao Root o mesmo escopo operacional de projetos do Admin nesta versão. Agentes autenticados por API Key SHALL herdar exatamente esse escopo do Owner, limitado adicionalmente pelos escopos da chave. Projetos ocultos SHALL ser excluídos do escopo de qualquer grupo, salvo quando a requisição informar `includeHidden=true`.

#### Scenario: Membro lista projetos
- **WHEN** um Membro de Equipe ou seu agente MCP solicita a lista de projetos
- **THEN** o sistema retorna somente projetos em que o Owner possui membership ativa e que estão no escopo da chave, se houver

#### Scenario: Gerente acessa projeto sem associação
- **WHEN** um Gerente ou seu agente MCP tenta acessar projeto do mesmo tenant no qual não possui membership
- **THEN** o sistema nega o acesso e não revela os dados do projeto

#### Scenario: Admin lista projetos do tenant
- **WHEN** um Admin, Root ou seu agente MCP solicita a lista de projetos
- **THEN** o sistema retorna somente projetos do tenant ativo permitidos pelo escopo da API Key, quando aplicável

#### Scenario: Admin não lista projeto restrito sem vínculo
- **WHEN** um Admin, Root ou seu agente MCP solicita a lista de projetos e existe projeto restrito no tenant sem membership e sem gerência do Owner
- **THEN** o sistema não retorna esse projeto e não revela sua existência

#### Scenario: Admin lista projeto restrito do qual participa
- **WHEN** um Admin, Root ou seu agente MCP possui membership em um projeto restrito
- **THEN** o sistema retorna esse projeto na listagem

#### Scenario: Nenhum grupo lista projetos ocultos por padrão
- **WHEN** qualquer grupo solicita a lista de projetos sem `includeHidden`
- **THEN** o sistema não retorna os projetos marcados como ocultos
