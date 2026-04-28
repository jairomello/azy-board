## ADDED Requirements

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
O sistema SHALL resolver o `tenant_id` do contexto autenticado antes de qualquer operação de negócio.

#### Scenario: Tenant resolvido do JWT
- **WHEN** usuário humano faz requisição com JWT válido
- **THEN** middleware extrai o `tenant_id` do payload do JWT e injeta no contexto da requisição

#### Scenario: Tenant resolvido da API Key
- **WHEN** agente de IA faz requisição com API Key válida
- **THEN** middleware busca o `tenant_id` associado à API Key no banco e injeta no contexto da requisição

#### Scenario: Requisição sem tenant resolvível
- **WHEN** JWT ou API Key não possui tenant_id válido associado
- **THEN** sistema retorna 401 sem processar a requisição

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
