## Purpose

Definir os requisitos de proteção do login: limitação de tentativas, auditoria de autenticação e política mínima de senha.

## Requirements

### Requirement: Limitação de tentativas de login por IP
O sistema SHALL limitar a quantidade de tentativas de login originadas de um mesmo endereço IP dentro de uma janela de tempo, registrando cada tentativa. Ao exceder o limite, o sistema SHALL responder HTTP 429 com código `RATE_LIMITED`, `retryable: true` e o header `Retry-After` indicando quando repetir.

#### Scenario: Tentativas dentro do limite
- **WHEN** um IP faz tentativas de login em quantidade inferior ao limite configurado dentro da janela
- **THEN** o sistema processa normalmente cada tentativa, sem bloquear por IP

#### Scenario: Limite por IP excedido
- **WHEN** um IP excede o número máximo de tentativas de login dentro da janela
- **THEN** o sistema responde HTTP 429 com `error.code = RATE_LIMITED` e header `Retry-After` maior que zero, sem verificar a senha

### Requirement: Limitação e atraso progressivo por identidade
O sistema SHALL limitar as tentativas de login por identidade (e-mail canônico), independentemente do IP, aplicando atraso progressivo às falhas repetidas e um bloqueio temporário após um número-limite de falhas dentro da janela. O contador SHALL ser zerado por um login bem-sucedido, e o bloqueio SHALL expirar ao fim da janela. A resposta durante o bloqueio SHALL NOT revelar se a conta existe.

#### Scenario: Atraso progressivo após falhas repetidas
- **WHEN** a mesma identidade acumula tentativas falhas consecutivas abaixo do limite de bloqueio
- **THEN** o sistema atrasa a resposta de cada nova falha de forma crescente, até um teto definido

#### Scenario: Bloqueio temporário por identidade
- **WHEN** a mesma identidade atinge o número-limite de falhas dentro da janela
- **THEN** novas tentativas, mesmo com a senha correta, são recusadas com HTTP 429 `RATE_LIMITED` e `Retry-After`, sem revelar se a conta existe

#### Scenario: Sucesso limpa as falhas
- **WHEN** a identidade autentica com sucesso após falhas anteriores dentro da janela
- **THEN** o sistema registra o sucesso e deixa de aplicar atraso ou bloqueio às próximas tentativas

#### Scenario: Bloqueio expira com a janela
- **WHEN** a janela de tempo do bloqueio termina
- **THEN** a identidade pode voltar a tentar o login normalmente

#### Scenario: A mesma identidade em IPs diferentes
- **WHEN** uma identidade é tentada a partir de endereços IP distintos
- **THEN** o limite por identidade continua sendo aplicado de forma agregada

### Requirement: Auditoria de tentativas de autenticação
O sistema SHALL persistir cada tentativa de login de forma append-only, registrando a identidade canônica, o endereço IP de origem, o resultado (`SUCCESS`, `FAILURE` ou `THROTTLED`) e o instante da tentativa. A auditoria SHALL NOT armazenar senha, hash de senha ou token.

#### Scenario: Falha registrada
- **WHEN** uma tentativa de login falha por credenciais inválidas
- **THEN** o sistema grava um registro com identidade canônica, IP, resultado `FAILURE` e timestamp, sem senha nem hash

#### Scenario: Sucesso registrado
- **WHEN** uma tentativa de login autentica com sucesso
- **THEN** o sistema grava um registro com resultado `SUCCESS`

#### Scenario: Tentativa bloqueada registrada
- **WHEN** uma tentativa é recusada por rate limit ou bloqueio
- **THEN** o sistema grava um registro com resultado `THROTTLED`

### Requirement: Política mínima de senha de conta
O sistema SHALL exigir uma política mínima de senha ao criar usuários: comprimento mínimo, rejeição de senha igual ao e-mail (ou ao trecho local), rejeição de senhas triviais e de um subconjunto de senhas comuns. A validação SHALL ocorrer no servidor; a autenticação de senhas já existentes SHALL NOT ser afetada.

#### Scenario: Senha curta rejeitada
- **WHEN** um Admin tenta criar usuário com senha abaixo do comprimento mínimo
- **THEN** o sistema responde erro de validação e não cria o usuário

#### Scenario: Senha trivial ou igual ao e-mail rejeitada
- **WHEN** um Admin tenta criar usuário com senha igual ao e-mail, ao trecho local do e-mail ou presente na lista de senhas comuns
- **THEN** o sistema responde erro de validação e não cria o usuário

#### Scenario: Senha válida aceita
- **WHEN** um Admin cria usuário com senha que atende à política
- **THEN** o sistema cria o usuário normalmente
