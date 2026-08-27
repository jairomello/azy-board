## MODIFIED Requirements

### Requirement: Escopo de projetos por grupo
O sistema SHALL permitir que Membros de Equipe e Gerentes visualizem somente projetos com membership ativa, SHALL permitir que Admins visualizem todos os projetos do tenant ativo e SHALL conceder ao Root o mesmo escopo operacional de projetos do Admin nesta versão. Agentes autenticados por API Key SHALL herdar exatamente esse escopo do Owner, limitado adicionalmente pelos escopos da chave.

#### Scenario: Membro lista projetos
- **WHEN** um Membro de Equipe ou seu agente MCP solicita a lista de projetos
- **THEN** o sistema retorna somente projetos em que o Owner possui membership ativa e que estão no escopo da chave, se houver

#### Scenario: Gerente acessa projeto sem associação
- **WHEN** um Gerente ou seu agente MCP tenta acessar projeto do mesmo tenant no qual não possui membership
- **THEN** o sistema nega o acesso e não revela os dados do projeto

#### Scenario: Admin lista projetos do tenant
- **WHEN** um Admin, Root ou seu agente MCP solicita a lista de projetos
- **THEN** o sistema retorna somente projetos do tenant ativo permitidos pelo escopo da API Key, quando aplicável

### Requirement: Permissões dentro do projeto
O sistema SHALL permitir que Membros de Equipe executem as operações de conteúdo autorizadas pelo projeto, mas SHALL negar o módulo Administração e as configurações do projeto. Gerentes SHALL poder criar projetos e administrar suas configurações, mas SHALL não acessar o módulo Administração. Admins e Root SHALL poder operar qualquer projeto permitido pelo tenant. Agentes MCP SHALL obedecer exatamente às mesmas regras do Owner.

#### Scenario: Membro acessa conteúdo do projeto
- **WHEN** um Membro de Equipe usa a API ou seu agente MCP para operar conteúdo em projeto onde é membro
- **THEN** o sistema permite somente as operações de conteúdo autorizadas pelo papel local

#### Scenario: Membro tenta abrir configurações
- **WHEN** um Membro de Equipe ou seu agente MCP acessa a rota ou ferramenta de configurações do projeto
- **THEN** o sistema retorna 403 e não altera nem expõe controles de configuração

#### Scenario: Gerente cria projeto
- **WHEN** um Gerente ou seu agente MCP cria novo projeto
- **THEN** o sistema cria o projeto conforme as regras existentes

#### Scenario: Gerente tenta acessar Administração
- **WHEN** um Gerente ou seu agente MCP tenta acessar o módulo Administração
- **THEN** o sistema retorna 403
