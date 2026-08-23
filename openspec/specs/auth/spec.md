## Purpose

Definir os requisitos da capacidade auth.

## Requirements

### Requirement: Autenticação de humanos via login fixo (MVP)
O sistema SHALL autenticar usuários humanos via e-mail e senha. No seed de desenvolvimento, a senha SHALL ser fornecida por `SEED_ADMIN_PASSWORD` e nunca SHALL ser publicada na documentação ou no código. A senha SHALL ser armazenada como hash bcrypt, nunca em texto plano.

#### Scenario: Login bem-sucedido
- **WHEN** usuário envia e-mail e senha corretos
- **THEN** sistema emite JWT assinado (HS256) com TTL de 1 hora armazenado em cookie HttpOnly; Secure; SameSite=Strict

#### Scenario: Credenciais inválidas
- **WHEN** usuário envia e-mail ou senha incorretos
- **THEN** sistema retorna 401 com mensagem genérica (não revela qual campo está errado)

#### Scenario: Acesso sem autenticação
- **WHEN** requisição chega sem token JWT válido
- **THEN** API retorna 401; frontend redireciona para página de login

---

### Requirement: Proteção de todas as rotas
O sistema SHALL exigir autenticação válida em todas as rotas, exceto `POST /auth/login`. Nenhuma página ou endpoint SHALL ser acessível sem token válido.

#### Scenario: Rota protegida sem token
- **WHEN** browser tenta acessar qualquer rota da aplicação sem cookie de sessão
- **THEN** frontend redireciona para `/login` antes de renderizar qualquer conteúdo

#### Scenario: Token expirado
- **WHEN** usuário faz requisição com JWT expirado
- **THEN** sistema retorna 401 e frontend redireciona para login

---

### Requirement: RBAC server-side
O sistema SHALL verificar, em cada operação, o grupo global do usuário (`TEAM_MEMBER`, `MANAGER`, `ADMIN`, `ROOT`) e, quando aplicável, o perfil do usuário no projeto (`ADMIN`, `MEMBER`, `VIEWER`), sem confiar em dados enviados pelo cliente. O grupo global SHALL definir o escopo de projetos e o perfil local SHALL complementar as permissões dentro de um projeto acessível.

#### Scenario: Usuário sem escopo tenta acessar projeto
- **WHEN** usuário autenticado tenta acessar projeto sem membership ativa e sem grupo global que permita o escopo
- **THEN** sistema retorna 404 ou 403 sem executar a operação

#### Scenario: VIEWER tentando criar card
- **WHEN** usuário com perfil VIEWER envia POST para criar card
- **THEN** sistema retorna 403 sem executar a operação

#### Scenario: Admin global opera projeto
- **WHEN** usuário com grupo ADMIN envia uma operação autorizada para um projeto do tenant
- **THEN** sistema permite a operação sem exigir membership local

#### Scenario: Perfil recebido do cliente é ignorado
- **WHEN** usuário envia um perfil ou grupo diferente do persistido no payload
- **THEN** sistema usa os valores persistidos no servidor e não concede a permissão solicitada

#### Scenario: MEMBER gerenciando colunas
- **WHEN** usuário com perfil MEMBER tenta criar ou excluir colunas (operação de ADMIN)
- **THEN** sistema retorna 403

---

### Requirement: Proteção anti-IDOR
O sistema SHALL incluir o `userId` autenticado e o `tenant_id` ativo como filtros obrigatórios nas queries de recursos com escopo de usuário ou tenant. Para Admin e Root, a ausência de membership local não SHALL remover o filtro de tenant.

#### Scenario: Acesso forçado por ID na URL
- **WHEN** usuário autenticado manipula ID na URL para tentar acessar projeto sem membership
- **THEN** query retorna vazio e API responde 404 (não revela existência do recurso)

#### Scenario: Admin acessa projeto do próprio tenant por ID
- **WHEN** Admin manipula um ID de projeto pertencente ao tenant ativo
- **THEN** a query retorna o projeto e a autorização permite a operação conforme o grupo

#### Scenario: Admin acessa projeto de outro tenant por ID
- **WHEN** Admin manipula um ID de projeto de outro tenant
- **THEN** a query não retorna o projeto e a API responde 404

#### Scenario: Manipulação de ID via console do browser
- **WHEN** usuário tenta chamar endpoint de API pelo console do browser com ID de recurso alheio
- **THEN** verificação server-side bloqueia a operação com 403 ou 404

---

### Requirement: API Key para agentes de IA
O sistema SHALL permitir geração de API Keys vinculadas a um Owner humano. A API Key SHALL ser usada no header `Authorization: Bearer {key}` e terá as mesmas permissões do Owner no projeto.

#### Scenario: Geração de API Key
- **WHEN** usuário ADMIN ou MEMBER solicita criação de API Key
- **THEN** sistema gera chave única, armazena o hash e exibe o valor completo uma única vez

#### Scenario: Requisição autenticada com API Key
- **WHEN** agente envia requisição com API Key válida
- **THEN** sistema autentica como o agente vinculado ao Owner e aplica permissões do Owner

#### Scenario: Identificação do agente no board
- **WHEN** agente faz claim de task
- **THEN** card exibe avatar do Owner humano com badge de IA (ícone de robô + nome do modelo informado na API Key)

---

### Requirement: Foto de perfil e avatar do usuário
O sistema SHALL permitir que cada usuário faça upload de uma foto de perfil. Quando não houver foto, o sistema SHALL gerar automaticamente um avatar com as iniciais do nome do usuário.

#### Scenario: Upload de foto de perfil
- **WHEN** usuário faz upload de imagem na página de perfil
- **THEN** imagem é salva no storage, redimensionada para tamanho padrão (256x256 px) e exibida como avatar em todos os cards e comentários do usuário

#### Scenario: Avatar por iniciais quando sem foto
- **WHEN** usuário não possui foto de perfil cadastrada
- **THEN** sistema exibe círculo colorido com as iniciais do nome (ex: "JS" para Jairo Silva) como avatar em todos os cards

#### Scenario: Avatar exibido nos cards
- **WHEN** task é atribuída a um usuário
- **THEN** avatar do responsável (foto ou iniciais) é exibido no card do Kanban e na Tree View
