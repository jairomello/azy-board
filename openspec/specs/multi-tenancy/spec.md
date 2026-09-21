## Purpose

Definir os requisitos da capacidade multi tenancy.
## Requirements
### Requirement: Isolamento de dados por tenant
O sistema SHALL isolar completamente os dados de cada tenant (cliente). Nenhuma query SHALL retornar dados de um tenant diferente do tenant autenticado, independente dos IDs fornecidos.

#### Scenario: Usuário de tenant A não acessa dados do tenant B
- **WHEN** usuário autenticado no tenant A faz qualquer requisição com IDs de recursos do tenant B
- **THEN** sistema retorna 404 sem revelar a existência do recurso, pois o `tenant_id` da query não coincide

#### Scenario: tenant_id incluído em todas as queries
- **WHEN** qualquer operação de leitura ou escrita é executada no banco
- **THEN** query obrigatoriamente inclui `WHERE tenant_id = :current_tenant_id` como filtro, sem exceção

---

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

---

### Requirement: Identidade global de usuário
O e-mail canônico (lower + trim) SHALL identificar globalmente um usuário. O mesmo endereço de e-mail não SHALL existir em dois usuários, sejam do mesmo tenant ou de tenants diferentes. O `tenant_id` SHALL ser atributo da identidade, resolvido no servidor a partir do login ou do registro, e nunca SHALL ser informado pelo cliente para desambiguar a autenticação.

#### Scenario: Login resolve identidade global
- **WHEN** usuário envia e-mail canônico e senha válidos
- **THEN** o sistema resolve a única identidade global desse e-mail e deriva dela o `tenant_id` da sessão

#### Scenario: E-mail já usado em outro tenant é rejeitado
- **WHEN** uma operação tenta cadastrar usuário com e-mail já existente em outro tenant
- **THEN** o banco rejeita a operação por violação de unicidade global e nenhum usuário é criado

---

### Requirement: Criação de tenant via script de setup
O sistema SHALL fornecer um script CLI (`bun run setup`) para criação do primeiro tenant e usuário administrador. Não SHALL existir endpoint de API ou interface gráfica para criação ou gerenciamento de tenants no MVP.

#### Scenario: Execução do script de setup
- **WHEN** operador executa `bun run setup --tenant "Nome da Empresa" --email admin@empresa.com`
- **THEN** sistema cria o tenant no banco, cria o usuário administrador e exibe as credenciais geradas

#### Scenario: Segundo tenant criado via script
- **WHEN** operador executa o script de setup novamente com dados de outro cliente
- **THEN** segundo tenant é criado com isolamento total do primeiro; usuários de um tenant não enxergam o outro

---

### Requirement: Estrutura de dados multi-tenant (shared schema)
O sistema SHALL implementar multi-tenancy por linha (row-level tenancy): todas as tabelas principais DEVEM conter a coluna `tenant_id` com FK para a tabela `tenants`. Índices compostos de `(tenant_id, id)` SHALL ser criados nas tabelas de maior volume.

#### Scenario: Schema com tenant_id em todas as tabelas
- **WHEN** banco de dados é inspecionado
- **THEN** as tabelas `users`, `projects`, `modules`, `epics`, `stories`, `tasks`, `columns`, `sprints`, `tags`, `attachments`, `api_keys` possuem coluna `tenant_id` NOT NULL

#### Scenario: Índices compostos para performance
- **WHEN** query filtra por tenant_id + outro campo (ex: `WHERE tenant_id = ? AND project_id = ?`)
- **THEN** índice composto `(tenant_id, project_id)` garante que a query não faça full table scan

---

### Requirement: Compatibilidade com arquiteturas futuras de isolamento mais forte
O sistema SHALL ser estruturado de forma que a migração para schema-per-tenant (PostgreSQL) ou database-per-tenant seja possível no futuro sem reescrever a lógica de negócio — apenas trocando a camada de resolução de conexão.

#### Scenario: Abstração da resolução de tenant
- **WHEN** desenvolvedor precisa migrar para schema-per-tenant no PostgreSQL
- **THEN** apenas o middleware de resolução de tenant e o helper de conexão precisam ser alterados; nenhum handler de rota ou serviço de negócio é afetado

### Requirement: Isolamento entre projetos do mesmo tenant

O sistema SHALL tratar `tenant_id` e `project_id` como escopos independentes em toda query de negócio. Conhecer um ID de entidade de outro projeto não SHALL permitir leitura ou modificação.

#### Scenario: Operação com projeto incorreto
- **WHEN** cliente autenticado chama uma rota com membership no projeto A e ID de entidade do projeto B
- **THEN** sistema retorna HTTP 404 e não altera dados de A ou B

#### Scenario: Associação de entidade externa
- **WHEN** cliente tenta associar item do projeto A a recurso do projeto B
- **THEN** sistema retorna erro de validação e mantém o estado original

### Requirement: WebSocket exige membership

O upgrade WebSocket SHALL validar JWT/API Key, tenant e membership no projeto solicitado antes de aceitar a conexão.

#### Scenario: Usuário sem membership solicita conexão
- **WHEN** usuário autenticado solicita WebSocket para projeto sem membership
- **THEN** servidor rejeita o upgrade sem revelar o recurso

### Requirement: Isolamento garantido pela camada de banco
Além do filtro de query, o schema SHALL representar o isolamento multi-tenant por chaves estrangeiras compostas com `tenant_id`, de modo que vínculos cross-tenant sejam rejeitados mesmo quando a aplicação falha.

#### Scenario: Aplicação ou script tenta vínculo cross-tenant
- **WHEN** uma escrita direta no banco, script de seed ou rota com bug tenta associar entidade a um pai de outro tenant
- **THEN** o banco rejeita a operação por violação de chave estrangeira, independentemente do filtro de aplicação

#### Scenario: Chaves compostas presentes nas relações
- **WHEN** o schema é inspecionado
- **THEN** as relações filho→pai usam `(tenant_id, <parent_id>)` e as tabelas pai possuem `UNIQUE (tenant_id, id)`

