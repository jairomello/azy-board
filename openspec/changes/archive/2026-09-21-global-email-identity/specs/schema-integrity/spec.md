## MODIFIED Requirements

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
