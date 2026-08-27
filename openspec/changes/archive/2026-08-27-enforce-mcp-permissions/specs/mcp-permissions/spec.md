## ADDED Requirements

### Requirement: Contexto efetivo do Owner
O MCP SHALL resolver o Owner humano da API Key no servidor, validando hash da chave, `owner_id`, `tenant_id`, grupo global persistido e estado de revogação/expiração antes de executar qualquer ferramenta. O agente SHALL herdar o grupo do Owner e nunca poderá informar outro grupo no payload.

#### Scenario: Agente herda grupo de Membro de Equipe
- **WHEN** API Key válida pertence a um usuário `TEAM_MEMBER`
- **THEN** toda ferramenta MCP aplica as permissões de Membro de Equipe desse usuário

#### Scenario: Grupo enviado pelo agente é ignorado
- **WHEN** uma chamada MCP inclui grupo global ou papel local diferente do persistido
- **THEN** o servidor ignora o valor enviado e usa somente a identidade persistida do Owner

#### Scenario: Owner inexistente ou chave inválida
- **WHEN** a API Key não possui Owner válido no tenant indicado, está expirada ou revogada
- **THEN** o servidor rejeita a chamada antes de consultar ou alterar qualquer recurso

### Requirement: Escopo de projeto herdado
O MCP SHALL permitir a Membros de Equipe e Gerentes somente projetos com membership ativa do Owner, SHALL permitir a Admins e Root projetos do tenant ativo conforme a política global, e SHALL aplicar adicionalmente o `projectScope` da API Key como restrição.

#### Scenario: Agente de gerente acessa projeto associado
- **WHEN** API Key de um Gerente é usada em projeto com membership ativa e dentro do escopo da chave
- **THEN** a ferramenta pode operar conforme as permissões de Gerente

#### Scenario: Agente de membro acessa projeto sem membership
- **WHEN** API Key de Membro de Equipe tenta acessar projeto sem sua membership ativa
- **THEN** o MCP retorna erro seguro de não encontrado/não autorizado sem revelar o projeto

#### Scenario: Admin do tenant acessa projeto sem membership
- **WHEN** API Key de Admin acessa projeto do tenant ativo sem membership local
- **THEN** o MCP permite a operação conforme o grupo e o escopo da chave

#### Scenario: Chave restringe projeto permitido
- **WHEN** o Owner poderia acessar um projeto, mas ele não está no `projectScope` da API Key
- **THEN** o MCP rejeita a operação sem revelar dados do projeto

### Requirement: Nível mínimo por ferramenta
Cada ferramenta MCP SHALL declarar e verificar seu nível mínimo de grupo global e, quando aplicável, o nível mínimo de papel local. Ferramentas de conteúdo SHALL respeitar o papel local; criação de projetos SHALL exigir `MANAGER`; configurações e administração SHALL exigir o nível correspondente da política REST.

#### Scenario: Membro usa operação de conteúdo permitida
- **WHEN** Membro de Equipe usa ferramenta de leitura ou mutação de conteúdo em projeto membro
- **THEN** o MCP permite somente a operação equivalente autorizada pela API REST

#### Scenario: Membro tenta configurar projeto
- **WHEN** API Key de Membro de Equipe invoca ferramenta de configuração, membros, squads ou administração do projeto
- **THEN** o MCP retorna 403 antes da mutação

#### Scenario: Gerente cria projeto
- **WHEN** API Key de Gerente invoca ferramenta de criação de projeto
- **THEN** o MCP permite a criação dentro do tenant do Owner

#### Scenario: Gerente tenta administração global
- **WHEN** API Key de Gerente invoca ferramenta de usuários ou outra ferramenta do módulo Admin
- **THEN** o MCP retorna 403 sem executar a operação

### Requirement: Defesa contra escalada e bypass
O MCP SHALL rejeitar parâmetros que tentem alterar o Owner, tenant, grupo, membership efetiva ou escopo da chave, e SHALL executar autorização antes de qualquer leitura, resolução de nome, contagem, escrita ou chamada downstream.

#### Scenario: Tenant forjado
- **WHEN** agente envia `tenantId` diferente do contexto da API Key
- **THEN** o servidor ignora ou rejeita o valor e não acessa dados do tenant informado

#### Scenario: Papel local forjado
- **WHEN** agente envia `role=ADMIN` para uma ferramenta usando membership inferior
- **THEN** o servidor usa o papel persistido e rejeita a operação se ela não for permitida

#### Scenario: Ferramenta desconhecida ou sem política
- **WHEN** o agente invoca ferramenta inexistente ou sem política de autorização registrada
- **THEN** o MCP rejeita a chamada sem executar fallback privilegiado

### Requirement: Revalidação em toda chamada
O MCP SHALL revalidar o estado da API Key, o Owner, seu grupo global, o tenant, o escopo da chave e a autorização do recurso em toda chamada de ferramenta, para que revogações e alterações de grupo tenham efeito imediato.

#### Scenario: Chave revogada durante sessão
- **WHEN** a API Key é revogada após o agente iniciar uma sessão MCP e antes da próxima chamada
- **THEN** a próxima chamada retorna 401 e não executa a ferramenta

#### Scenario: Grupo do Owner reduzido
- **WHEN** o grupo do Owner é alterado de Admin para Membro de Equipe
- **THEN** a próxima chamada perde o acesso administrativo sem reiniciar o MCP

### Requirement: Erros MCP sem vazamento
O MCP SHALL retornar erros estruturados com código estável e mensagem segura para negações, sem incluir dados, nomes, IDs ou contagens de recursos fora do escopo. Falhas de autorização SHALL ser não-retryable.

#### Scenario: Recurso fora do escopo
- **WHEN** Owner ou API Key não têm autorização para um projeto ou recurso
- **THEN** a resposta não revela se o recurso existe e indica que a operação não é autorizada

#### Scenario: Falha transitória distinta
- **WHEN** a operação falha por indisponibilidade transitória do serviço downstream
- **THEN** o MCP retorna erro próprio com indicação de retry sem transformar a falha em autorização concedida
