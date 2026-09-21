# schema-integrity Specification

## Purpose
TBD - created by archiving change enforce-schema-integrity. Update Purpose after archive.
## Requirements
### Requirement: Integridade referencial escopada por tenant
O banco SHALL impedir que qualquer tabela filha referencie uma entidade de outro tenant. Toda relação entre entidades SHALL ser expressa por chave estrangeira composta que inclui `tenant_id`, e a tabela pai SHALL possuir `UNIQUE (tenant_id, id)` para sustentar o vínculo.

#### Scenario: Tentativa de vínculo cross-tenant no banco
- **WHEN** uma inserção ou atualização tenta referenciar um pai com `tenant_id` diferente do filho
- **THEN** o banco rejeita a operação por violação de chave estrangeira e nenhum dado é gravado

#### Scenario: Entidade órfã rejeitada
- **WHEN** uma operação tenta gravar um filho com referência a um pai inexistente
- **THEN** o banco rejeita a operação por violação de chave estrangeira

### Requirement: Unicidade de identidade e associação
O banco SHALL garantir unicidade global de e-mail e unicidade de membership por projeto/usuário e de associação item-tag. A unicidade de e-mail SHALL incidir sobre o e-mail canônico (lower + trim), independentemente do tenant.

#### Scenario: E-mail duplicado no mesmo tenant
- **WHEN** uma operação tenta cadastrar usuário com e-mail já existente no mesmo tenant, ignorando diferenças de caixa
- **THEN** o banco rejeita a operação por violação de unicidade

#### Scenario: Mesmo e-mail em tenants diferentes é rejeitado
- **WHEN** dois tenants tentam cadastrar o mesmo endereço de e-mail
- **THEN** o banco rejeita o segundo cadastro por violação da unicidade global de e-mail, preservando a primeira identidade

#### Scenario: Saneamento de e-mails duplicados legados
- **WHEN** a migration encontra o mesmo e-mail em tenants diferentes
- **THEN** mantém o registro mais antigo no endereço canônico e preserva os demais com sufixo determinístico antes de criar o índice único global

#### Scenario: Membership duplicado
- **WHEN** uma operação tenta inserir o mesmo usuário no mesmo projeto do mesmo tenant mais de uma vez
- **THEN** o banco rejeita a segunda inserção por violação de unicidade

#### Scenario: Tag repetida no mesmo item
- **WHEN** uma operação tenta associar a mesma tag ao mesmo item mais de uma vez
- **THEN** o banco rejeita a duplicata pela chave primária de `item_tags`

### Requirement: Integridade de hierarquia no banco
`items.parent_id` SHALL possuir auto-chave estrangeira composta com `tenant_id`, de modo que o pai pertença ao mesmo tenant e exista.

#### Scenario: Pai inexistente ou de outro tenant
- **WHEN** um item é gravado com `parent_id` que não existe no mesmo tenant
- **THEN** o banco rejeita a operação

#### Scenario: Hierarquia permanece consultável
- **WHEN** os itens válidos existentes são reconsultados após a migration
- **THEN** todos os vínculos de pai e filho previamente válidos permanecem intactos

### Requirement: Constraints de domínio numérico e temporal
O banco SHALL rejeitar valores que violem invariantes de domínio: números negativos onde não fazem sentido e intervalos de datas invertidos.

#### Scenario: Número negativo rejeitado
- **WHEN** uma operação tenta gravar `points`, `position`, `planned_points` ou `planned_hours` negativo
- **THEN** o banco rejeita a operação por violação de `CHECK`

#### Scenario: Intervalo de datas invertido
- **WHEN** uma operação tenta gravar sprint com `end_date` anterior a `start_date`, ou item com `due_date` anterior a `start_date`
- **THEN** o banco rejeita a operação por violação de `CHECK`

### Requirement: Saneamento determinístico antes das constraints
A migration SHALL sanear dados inválidos antes de aplicar as constraints, preservando o máximo de dados válidos e registrando o que foi alterado.

#### Scenario: Duplicatas pré-existentes
- **WHEN** a migration encontra memberships, e-mails ou associações item-tag duplicadas
- **THEN** ela preserva um registro canônico por regra determinística e remove os excedentes

#### Scenario: Referências órfãs pré-existentes
- **WHEN** a migration encontra `parent_id`, `manager_user_id` ou `simple_story_id` apontando para registros inexistentes
- **THEN** ela anula a referência inválida sem apagar a entidade

#### Scenario: Base já íntegra
- **WHEN** a migration é executada em uma base sem violações
- **THEN** nenhum dado é alterado além da estrutura e a execução é concluída com sucesso

### Requirement: Falhas de constraint viram erros de domínio
A API SHALL traduzir violações de constraint do banco para o contrato único de erro com status `409` ou `422` e `retryable: false`, sem expor SQL ou detalhes internos.

#### Scenario: Conflito de unicidade via API
- **WHEN** uma requisição tenta criar um recurso que viola unicidade
- **THEN** a API responde `409` com código de conflito no envelope único

#### Scenario: Violação de CHECK via API
- **WHEN** uma requisição tenta gravar valor inválido barrado por constraint
- **THEN** a API responde `422` com código de validação no envelope único

