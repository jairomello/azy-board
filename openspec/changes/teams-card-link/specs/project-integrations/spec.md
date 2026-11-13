# Spec Delta — project-integrations

## ADDED Requirements

### Requirement: Configuração da integração com o Teams
O sistema SHALL permitir que um ADMIN do projeto configure, ative, desative, teste e remova um webhook de entrada do Teams por projeto. A URL SHALL ser validada como HTTPS de domínio do Teams, SHALL NOT ser devolvida por inteiro em nenhuma leitura e SHALL permanecer isolada por tenant e projeto.

#### Scenario: Configurar o webhook
- **WHEN** um ADMIN informa uma URL HTTPS de webhook do Teams e salva
- **THEN** a integração fica ativa para o projeto e a leitura seguinte devolve apenas host e máscara

#### Scenario: URL inválida
- **WHEN** a URL não é HTTPS ou não pertence a um domínio do Teams
- **THEN** o sistema recusa com erro de validação e não grava a configuração

#### Scenario: Acesso negado
- **WHEN** um usuário VIEWER ou MEMBER tenta ler, criar, alterar ou remover a integração
- **THEN** o sistema responde com permissão negada

#### Scenario: Projeto de outro tenant
- **WHEN** um usuário autenticado tenta configurar a integração de um projeto de outro tenant
- **THEN** o sistema responde como recurso inexistente, sem revelar a existência do projeto

#### Scenario: Enviar teste
- **WHEN** um ADMIN aciona o envio de teste
- **THEN** o sistema posta um cartão de teste no canal e informa sucesso ou o erro retornado

### Requirement: Link do card criado no Teams
O sistema SHALL notificar o canal configurado quando um card é criado por qualquer canal de entrada (UI, MCP ou API), enviando um cartão com código, título, tipo, status, responsável e o link direto do card. A notificação SHALL ocorrer de forma assíncrona e SHALL NOT impedir nem desfazer a criação do card.

#### Scenario: Card criado por MCP durante reunião
- **WHEN** um agente cria um card via MCP em projeto com integração ativa
- **THEN** o canal recebe um cartão com o link direto do card criado

#### Scenario: Integração desativada
- **WHEN** o projeto não tem integração ativa
- **THEN** nenhuma entrega é enfileirada e a criação do card segue normalmente

#### Scenario: Falha no Teams
- **WHEN** o webhook responde erro ou não responde
- **THEN** o card permanece criado, a entrega é reagendada e o erro fica registrado

### Requirement: Entrega confiável e observável
O sistema SHALL entregar cada evento no máximo uma vez por integração, com tentativas e backoff, marcando a entrega como falha definitiva após o limite. O sistema SHALL expor a quantidade de entregas pendentes e de falhas na configuração do projeto.

#### Scenario: Repetição do mesmo evento
- **WHEN** o mesmo evento é processado mais de uma vez
- **THEN** apenas uma entrega é enviada para a integração

#### Scenario: Limite de tentativas
- **WHEN** a entrega excede o número máximo de tentativas
- **THEN** ela é marcada como falha definitiva e aparece na configuração do projeto

#### Scenario: URL não exposta em erro
- **WHEN** uma entrega falha e o erro é exibido na configuração
- **THEN** a mensagem não revela a URL completa do webhook
