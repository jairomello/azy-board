## ADDED Requirements

### Requirement: Identidade global de usuário
O e-mail canônico (lower + trim) SHALL identificar globalmente um usuário. O mesmo endereço de e-mail não SHALL existir em dois usuários, sejam do mesmo tenant ou de tenants diferentes. O `tenant_id` SHALL ser atributo da identidade, resolvido no servidor a partir do login ou do registro, e nunca SHALL ser informado pelo cliente para desambiguar a autenticação.

#### Scenario: Login resolve identidade global
- **WHEN** usuário envia e-mail canônico e senha válidos
- **THEN** o sistema resolve a única identidade global desse e-mail e deriva dela o `tenant_id` da sessão

#### Scenario: E-mail já usado em outro tenant é rejeitado
- **WHEN** uma operação tenta cadastrar usuário com e-mail já existente em outro tenant
- **THEN** o banco rejeita a operação por violação de unicidade global e nenhum usuário é criado

## MODIFIED Requirements

### Requirement: Resolução de tenant via JWT e API Key
O sistema SHALL resolver o `tenant_id` do contexto autenticado antes de qualquer operação de negócio. Para humanos, o `tenant_id` SHALL ser derivado da identidade global resolvida no login; para agentes, SHALL ser o tenant associado à API Key.

#### Scenario: Tenant resolvido do JWT
- **WHEN** usuário humano faz requisição com JWT válido
- **THEN** middleware extrai o `tenant_id` do payload do JWT e injeta no contexto da requisição

#### Scenario: Tenant derivado da identidade no login
- **WHEN** usuário humano autentica com e-mail e senha válidos
- **THEN** o sistema resolve a identidade global pelo e-mail canônico e emite o JWT com o `tenant_id` persistido dessa identidade

#### Scenario: Tenant resolvido da API Key
- **WHEN** agente de IA faz requisição com API Key válida
- **THEN** middleware busca o `tenant_id` associado à API Key no banco e injeta no contexto da requisição

#### Scenario: Requisição sem tenant resolvível
- **WHEN** JWT ou API Key não possui tenant_id válido associado
- **THEN** sistema retorna 401 sem processar a requisição
