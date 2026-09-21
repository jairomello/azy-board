## MODIFIED Requirements

### Requirement: Autenticação de humanos via login fixo (MVP)
O sistema SHALL autenticar usuários humanos via e-mail e senha. A identidade do usuário SHALL ser global e determinada pelo e-mail canônico (lower + trim); o `tenant_id` SHALL ser derivado da identidade resolvida, e não SHALL ser usado para desambiguar o login. No seed de desenvolvimento, a senha SHALL ser fornecida por `SEED_ADMIN_PASSWORD` e nunca SHALL ser publicada na documentação ou no código. A senha SHALL ser armazenada como hash bcrypt, nunca em texto plano.

#### Scenario: Login bem-sucedido
- **WHEN** usuário envia e-mail e senha corretos
- **THEN** sistema emite JWT assinado (HS256) com TTL de 1 hora armazenado em cookie HttpOnly; Secure; SameSite=Strict

#### Scenario: Login determinístico por identidade global
- **WHEN** usuário envia e-mail canônico que identifica exatamente um usuário no sistema
- **THEN** o sistema resolve essa identidade de forma determinística e deriva o `tenant_id` do JWT do usuário encontrado

#### Scenario: E-mail repetido entre tenants não é mais possível
- **WHEN** o sistema contém dados legados com o mesmo e-mail em tenants diferentes
- **THEN** o saneamento da migration mantém a identidade canônica mais antiga e renomeia as demais, de modo que o login por e-mail nunca seleciona uma conta imprevisível

#### Scenario: Credenciais inválidas
- **WHEN** usuário envia e-mail ou senha incorretos
- **THEN** sistema retorna 401 com mensagem genérica (não revela qual campo está errado)

#### Scenario: Acesso sem autenticação
- **WHEN** requisição chega sem token JWT válido
- **THEN** API retorna 401; frontend redireciona para página de login
