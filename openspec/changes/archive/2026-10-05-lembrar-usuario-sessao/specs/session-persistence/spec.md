## ADDED Requirements

### Requirement: Opção "lembrar-me" na tela de login
O sistema SHALL oferecer na tela de login uma opção "Lembrar-me neste dispositivo", desmarcada por padrão, que controla simultaneamente a duração estendida da sessão e o preenchimento automático do e-mail. A aplicação SHALL NOT persistir a senha em nenhuma hipótese.

#### Scenario: Login com lembrar-me desmarcado
- **WHEN** usuário faz login sem marcar "Lembrar-me neste dispositivo"
- **THEN** a sessão usa a duração padrão, o e-mail não é persistido para preenchimento e a autenticação segue o fluxo normal

#### Scenario: Login com lembrar-me marcado
- **WHEN** usuário faz login marcando "Lembrar-me neste dispositivo"
- **THEN** a sessão usa a duração estendida e o e-mail é lembrado para o próximo login, sem persistir a senha

### Requirement: Duração da sessão configurável
O sistema SHALL manter a sessão autenticada por no mínimo 24 horas na configuração padrão e SHALL permitir sessão estendida para dispositivos lembrados, com as durações definidas por variáveis de ambiente (`SESSION_TTL`, `SESSION_REMEMBER_TTL` e `SESSION_MAX_TTL`). O `exp` do JWT e o `maxAge` do cookie SHALL refletir a duração escolhida no login.

#### Scenario: Sessão padrão dura pelo menos 24 horas
- **WHEN** usuário faz login sem lembrar o dispositivo
- **THEN** o cookie de sessão e o JWT expiram somente após o período padrão configurado, que não é inferior a 24 horas

#### Scenario: Sessão estendida do dispositivo lembrado
- **WHEN** usuário faz login lembrando o dispositivo
- **THEN** o cookie de sessão e o JWT usam a duração estendida configurada, superior à duração padrão

#### Scenario: Duração configurável por instalação
- **WHEN** a instalação define as variáveis de duração da sessão
- **THEN** o sistema aplica os valores configurados no JWT e no cookie, sem recompilar o código

### Requirement: Renovação deslizante com limite absoluto
O sistema SHALL renovar a sessão de usuários ativos quando o token ultrapassar metade da duração configurada, reemitindo JWT e cookie com a duração cheia. A renovação SHALL NOT ocorrer após o limite absoluto `SESSION_MAX_TTL` contado a partir do login original, momento em que a sessão SHALL ser considerada expirada.

#### Scenario: Renovação em dispositivo usado com frequência
- **WHEN** usuário autenticado faz uma requisição após mais de metade da duração da sessão e antes do limite absoluto
- **THEN** o sistema reemite o JWT e o cookie com nova expiração completa, mantendo a escolha de lembrar o dispositivo

#### Scenario: Limite absoluto atingido
- **WHEN** o tempo desde o login original alcança o limite absoluto configurado, mesmo com renovação
- **THEN** o sistema trata a sessão como expirada, responde 401 e o frontend redireciona para o login

#### Scenario: Sessão de agente não é renovada por esse fluxo
- **WHEN** a requisição é autenticada por API Key de agente
- **THEN** o sistema não aplica a renovação deslizante de sessão humana

### Requirement: Lembrança do e-mail para o próximo login
O sistema SHALL lembrar o e-mail do usuário no dispositivo quando "lembrar-me" estiver ativo e SHALL pré-preenchê-lo na tela de login. O e-mail lembrado SHALL ser removido quando o usuário fizer login sem a opção marcada, e a sessão SHALL ser encerrada pelo logout.

#### Scenario: E-mail pré-preenchido em login anterior lembrado
- **WHEN** usuário que marcou "lembrar-me" retorna à tela de login
- **THEN** o campo de e-mail aparece pré-preenchido e o usuário informa apenas a senha

#### Scenario: E-mail não persiste sem lembrar
- **WHEN** usuário faz login sem marcar "lembrar-me"
- **THEN** nenhum e-mail é persistido para preenchimento automático

#### Scenario: Logout encerra a sessão do dispositivo
- **WHEN** usuário aciona o logout
- **THEN** o cookie de sessão é apagado e a aplicação volta a exigir login, preservando apenas o e-mail lembrado quando a opção estava ativa

### Requirement: Atributos de segurança do cookie preservados
O sistema SHALL manter o cookie de sessão como HttpOnly, Secure em produção, SameSite=Strict e path=`/`, independentemente da duração escolhida no "lembrar-me". A persistência SHALL ser por dispositivo (o próprio cookie), sem armazenar o token em JavaScript.

#### Scenario: Cookie permanece protegido com sessão estendida
- **WHEN** a sessão é estendida por "lembrar-me"
- **THEN** o cookie continua HttpOnly, Secure em produção, SameSite=Strict e path=`/`, e o token não é acessível ao JavaScript
