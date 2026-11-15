# Spec Delta — teams-card-creation

## ADDED Requirements

### Requirement: Configuração da criação de cards pelo Teams
O sistema SHALL permitir que um ADMIN do projeto ative a criação de cards pelo Teams, gerando uma URL pública com token de alta entropia e armazenando o token de segurança emitido pelo Teams. A configuração SHALL definir tipo e coluna iniciais e SHALL permitir ativar, desativar, rotacionar o token e remover a integração. O segredo SHALL NOT ser devolvido em nenhuma leitura.

#### Scenario: Ativar a integração
- **WHEN** um ADMIN ativa a integração informando o token de segurança do Teams
- **THEN** o sistema exibe a URL pública para colar no Teams e a integração fica pronta para receber mensagens

#### Scenario: Remover a integração
- **WHEN** um ADMIN remove a integração
- **THEN** a URL deixa de resolver e o histórico de mensagens da integração é removido

#### Scenario: Acesso negado
- **WHEN** um usuário VIEWER ou MEMBER tenta ler ou alterar a integração
- **THEN** o sistema responde com permissão negada

#### Scenario: Histórico de mensagens
- **WHEN** um ADMIN abre a configuração
- **THEN** o sistema mostra as últimas mensagens recebidas com resultado (card criado, ignorada ou erro)

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
O sistema SHALL interpretar a mensagem mencionando o bot, criando um card do tipo configurado na coluna inicial configurada, com o título informado e as datas opcionais de início e fim. O card SHALL entrar no módulo `Backlog` sob a história de entrada do Teams, registrar a origem `TEAMS` e o identificador da mensagem, e SHALL NOT atribuir responsável.

#### Scenario: Comando simples
- **WHEN** a mensagem é `@Azy criar ajustar X, Y e Z na camada W`
- **THEN** um card `TASK` é criado no Backlog com esse título e origem `TEAMS`, sem responsável

#### Scenario: Comando com datas
- **WHEN** a mensagem é `@Azy criar revisar camada W; data inicio 18/11/26; data fim 25/11/26.`
- **THEN** o card é criado com início `2026-11-18` e fim `2026-11-25`, sem responsável

#### Scenario: Comando com descrição
- **WHEN** a mensagem é `@Azy criar atividade de teste; detalhar a desc do teste; 12/12/26; 13/12/26`
- **THEN** o card recebe a descrição "detalhar a desc do teste", início `2026-12-12` e fim `2026-12-13`

#### Scenario: Descrição com rótulo
- **WHEN** a mensagem inclui `; descrição Validar o fluxo com o time`
- **THEN** a descrição do card recebe esse texto, sem HTML da mensagem

#### Scenario: HTML da mensagem
- **WHEN** o Teams envia o texto dentro de `<p>` com a menção `<at>`
- **THEN** o título e a descrição chegam limpos, sem tags

#### Scenario: Data inválida
- **WHEN** a data informada não é uma data válida
- **THEN** o card é criado sem essa data e a resposta informa o que não foi entendido

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
