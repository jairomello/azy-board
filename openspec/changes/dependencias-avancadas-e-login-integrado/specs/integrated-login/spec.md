# Spec Delta

## Purpose

Permitir que cada instalação escolha, no momento da instalação, o método de autenticação humana — usuário e senha local, Microsoft EntraID ou Google — e adaptar a tela de login e a criação de sessão a essa escolha, preservando o modelo de identidade global multi-tenant.

## ADDED Requirements

### Requirement: Provedor de autenticação definido na instalação
O sistema SHALL determinar o provedor de autenticação humana a partir da configuração de instalação (`AZYBOARD_AUTH_PROVIDER`), aceitando `LOCAL` (padrão), `MICROSOFT` ou `GOOGLE`. A escolha SHALL ser permanente por instalação, sem migração ou troca em tempo de execução, e SHALL ser validada na inicialização, falhando de forma explícita quando um provedor integrado for selecionado sem as credenciais exigidas.

#### Scenario: Provedor local como padrão
- **WHEN** a configuração de instalação não define o provedor de autenticação
- **THEN** o sistema assume `LOCAL` e mantém o login por e-mail e senha

#### Scenario: Provedor integrado sem credenciais falha na inicialização
- **WHEN** o provedor é `MICROSOFT` ou `GOOGLE` e faltam as credenciais de cliente exigidas
- **THEN** o sistema recusa iniciar com erro explícito de configuração

#### Scenario: Valor de provedor inválido
- **WHEN** a configuração informa um provedor diferente de `LOCAL`, `MICROSOFT` ou `GOOGLE`
- **THEN** o sistema recusa iniciar com erro de configuração acionável

### Requirement: Descoberta pública do provedor de autenticação
O sistema SHALL expor um endpoint público, acessível sem sessão, que informa à tela de login o provedor configurado e os dados não sensíveis necessários para iniciar o fluxo, sem revelar segredos nem a existência de contas.

#### Scenario: Configuração exposta antes do login
- **WHEN** a tela de login carrega sem sessão ativa
- **THEN** ela obtém do endpoint público o provedor configurado e monta os controles correspondentes

#### Scenario: Nenhum segredo exposto
- **WHEN** o endpoint público responde
- **THEN** a resposta não contém segredos de cliente, hashes ou dados de usuários

### Requirement: Tela de login adaptada ao provedor
A tela de login SHALL apresentar apenas os controles do provedor configurado: campos de e-mail e senha no modo local; um único botão "Entrar com Microsoft" no modo Microsoft; e um único botão "Entrar com Google" no modo Google. Controles de provedores não configurados SHALL NOT ser exibidos.

#### Scenario: Modo local mostra apenas campos de senha
- **WHEN** o provedor é `LOCAL`
- **THEN** a tela exibe os campos de e-mail e senha e não exibe botões de provedores integrados

#### Scenario: Modo Microsoft mostra apenas o botão Microsoft
- **WHEN** o provedor é `MICROSOFT`
- **THEN** a tela exibe apenas o botão "Entrar com Microsoft", sem campos de senha nem botão Google

#### Scenario: Modo Google mostra apenas o botão Google
- **WHEN** o provedor é `GOOGLE`
- **THEN** a tela exibe apenas o botão "Entrar com Google", sem campos de senha nem botão Microsoft

### Requirement: Login integrado por OAuth/OIDC
Nos modos integrados, o sistema SHALL iniciar o fluxo de autorização (authorization code) no provedor, tratar o callback validando `state` e o `id_token` junto ao provedor, e resolver a identidade pelo e-mail canônico verificado. Em caso de sucesso, o sistema SHALL emitir a mesma sessão (JWT HS256 em cookie HttpOnly; Secure; SameSite=Strict) do login local, derivando o `tenant_id` da identidade resolvida.

#### Scenario: Callback válido cria sessão
- **WHEN** o provedor retorna um callback com `state` válido e `id_token` verificável
- **THEN** o sistema resolve a identidade e emite a sessão no cookie, redirecionando o usuário para a aplicação

#### Scenario: State ou id_token inválidos rejeitados
- **WHEN** o `state` não corresponde ao iniciado ou o `id_token` não é validável
- **THEN** o sistema recusa a autenticação sem emitir sessão

#### Scenario: Sessão idêntica à do login local
- **WHEN** a autenticação integrada conclui
- **THEN** a sessão resultante tem o mesmo formato, cookie e duração do login local

### Requirement: Vinculação de identidade externa
O sistema SHALL associar a identidade do provedor externo a um usuário existente pelo e-mail canônico; o sistema SHALL NOT criar usuário automaticamente nem cruzar tenants. Quando a identidade não corresponder a um usuário do tenant, o acesso SHALL ser recusado com mensagem genérica e a tentativa registrada na auditoria de autenticação.

#### Scenario: Usuário existente vinculado pelo e-mail
- **WHEN** o e-mail verificado do provedor corresponde a um usuário existente do tenant
- **THEN** o sistema autentica esse usuário e registra a vinculação da identidade externa

#### Scenario: E-mail desconhecido recusado
- **WHEN** o e-mail verificado do provedor não corresponde a nenhum usuário do tenant
- **THEN** o sistema recusa o acesso com mensagem genérica e não cria usuário

#### Scenario: Segregação entre tenants mantida
- **WHEN** o e-mail verificado existe apenas em outro tenant
- **THEN** o sistema recusa o acesso sem revelar a existência da conta

### Requirement: Desativação do login local em instalações integradas
Quando o provedor configurado não for `LOCAL`, o sistema SHALL recusar a autenticação por e-mail e senha e SHALL manter bloqueadas as rotas de login por senha, sem afetar a autenticação por API Key de agentes.

#### Scenario: Login por senha recusado no modo integrado
- **WHEN** uma requisição tenta autenticar por e-mail e senha enquanto o provedor é integrado
- **THEN** o sistema recusa a autenticação e orienta o uso do provedor configurado

#### Scenario: API Key de agente continua válida
- **WHEN** um agente autentica com API Key enquanto o provedor humano é integrado
- **THEN** o sistema autentica o agente normalmente
