# Spec Delta — teams-card-creation

## ADDED Requirements

### Requirement: Configuração da criação de cards pelo Teams
O sistema SHALL permitir que um ADMIN do projeto ative a criação de cards pelo Teams, gerando uma URL pública com token de alta entropia e armazenando o token de segurança emitido pelo Teams. A configuração SHALL definir tipo e coluna iniciais e SHALL permitir ativar, desativar, rotacionar o token e remover a integração. O segredo SHALL NOT ser devolvido em nenhuma leitura.

#### Scenario: Ativar a integração
- **WHEN** um ADMIN ativa a integração informando o token de segurança do Teams
- **THEN** o sistema exibe a URL pública para colar no Teams e a integração fica pronta para receber mensagens

#### Scenario: Rotacionar o token público
- **WHEN** um ADMIN rotaciona o token público
- **THEN** a URL anterior deixa de resolver e a nova passa a valer

#### Scenario: Acesso negado
- **WHEN** um usuário VIEWER ou MEMBER tenta ler ou alterar a integração
- **THEN** o sistema responde com permissão negada

### Requirement: Recebimento autenticado de mensagem do Teams
O sistema SHALL expor um endpoint público que resolve a integração pelo token da URL, valida a assinatura HMAC do Teams e rejeita requisições sem assinatura válida, com token desconhecido ou com integração inativa. O endpoint SHALL limitar o tamanho do corpo, aceitar apenas JSON e aplicar limite de uso por integração.

#### Scenario: Assinatura válida
- **WHEN** o Teams envia uma mensagem assinada com o token de segurança correto
- **THEN** o sistema processa a mensagem

#### Scenario: Assinatura inválida
- **WHEN** a assinatura está ausente ou não confere
- **THEN** o sistema responde 401 e não cria nada

#### Scenario: Token desconhecido
- **WHEN** a URL usa um token que não pertence a nenhuma integração ativa
- **THEN** o sistema responde como recurso inexistente, sem revelar detalhes

#### Scenario: Excesso de mensagens
- **WHEN** a integração recebe mais mensagens do que o limite por minuto
- **THEN** o sistema responde 429 com `Retry-After` e não cria o card

### Requirement: Criação do card a partir da mensagem
O sistema SHALL interpretar a mensagem mencionando o bot, criando um card do tipo configurado na coluna inicial configurada, com o título informado e os campos opcionais reconhecidos (`tipo`, `prazo`, `responsável`). O card SHALL registrar a origem `TEAMS` e o identificador da mensagem, e o autor SHALL ser registrado como responsável externo com o nome exibido no Teams.

#### Scenario: Comando simples
- **WHEN** a mensagem é `@Azy criar ajustar X, Y e Z na camada W`
- **THEN** um card `TASK` é criado na coluna inicial com esse título e origem `TEAMS`

#### Scenario: Comando com campos
- **WHEN** a mensagem informa `tipo: BUG`, `prazo` e `responsável`
- **THEN** o card é criado com esses valores e o restante no padrão

#### Scenario: Mensagem sem comando
- **WHEN** a mensagem menciona o bot sem a palavra `criar`
- **THEN** nada é criado e a resposta explica o formato aceito

#### Scenario: Título inválido
- **WHEN** o título está vazio ou excede o limite
- **THEN** nada é criado e a resposta informa o erro

### Requirement: Resposta na conversa
O sistema SHALL responder na mesma conversa com o código e o link do card criado, ou com uma mensagem de erro legível quando a criação não ocorrer.

#### Scenario: Card criado
- **WHEN** a criação termina com sucesso
- **THEN** a resposta traz o código do card e o link direto para abri-lo no Azy Board

#### Scenario: Falha na criação
- **WHEN** a criação falha por validação ou erro interno
- **THEN** a resposta informa o motivo sem expor detalhes internos

### Requirement: Idempotência da mensagem
O sistema SHALL garantir que a mesma mensagem do Teams gere no máximo um card, mesmo que o Teams reenvie a requisição.

#### Scenario: Reenvio da mesma mensagem
- **WHEN** o Teams envia duas vezes a mensagem com o mesmo identificador
- **THEN** o sistema devolve o mesmo card e não cria um segundo
