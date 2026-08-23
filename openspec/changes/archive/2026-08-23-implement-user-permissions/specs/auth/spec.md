## MODIFIED Requirements

### Requirement: RBAC server-side
O sistema SHALL verificar, em cada operação, o grupo global do usuário (`TEAM_MEMBER`, `MANAGER`, `ADMIN`, `ROOT`) e, quando aplicável, o perfil do usuário no projeto (`ADMIN`, `MEMBER`, `VIEWER`), sem confiar em dados enviados pelo cliente. O grupo global SHALL definir o escopo de projetos e o perfil local SHALL complementar as permissões dentro de um projeto acessível.

#### Scenario: Usuário sem escopo tenta acessar projeto
- **WHEN** usuário autenticado tenta acessar projeto sem membership ativa e sem grupo global que permita o escopo
- **THEN** sistema retorna 404 ou 403 sem executar a operação

#### Scenario: Viewer tentando criar card
- **WHEN** usuário com perfil VIEWER envia POST para criar card
- **THEN** sistema retorna 403 sem executar a operação

#### Scenario: Admin global opera projeto
- **WHEN** usuário com grupo ADMIN envia uma operação autorizada para um projeto do tenant
- **THEN** sistema permite a operação sem exigir membership local

#### Scenario: Perfil recebido do cliente é ignorado
- **WHEN** usuário envia um perfil ou grupo diferente do persistido no payload
- **THEN** sistema usa os valores persistidos no servidor e não concede a permissão solicitada

### Requirement: Proteção anti-IDOR
O sistema SHALL incluir o `userId` autenticado e o `tenant_id` ativo como filtros obrigatórios nas queries de recursos com escopo de usuário ou tenant. Para Admin e Root, a ausência de membership local não SHALL remover o filtro de tenant.

#### Scenario: Admin acessa projeto do próprio tenant por ID
- **WHEN** Admin manipula um ID de projeto pertencente ao tenant ativo
- **THEN** a query retorna o projeto e a autorização permite a operação conforme o grupo

#### Scenario: Admin acessa projeto de outro tenant por ID
- **WHEN** Admin manipula um ID de projeto de outro tenant
- **THEN** a query não retorna o projeto e a API responde 404
