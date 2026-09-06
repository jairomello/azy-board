## ADDED Requirements

### Requirement: Cortina lateral global do Azy Agent
O frontend SHALL exibir uma cortina lateral de chat no lado direito das telas protegidas quando o tenant tiver o Azy Agent disponível, permitindo abrir, fechar, redimensionar em desktop quando suportado e usar layout adaptado em mobile.

#### Scenario: Assistente disponível
- **WHEN** usuário autenticado acessa uma tela com configuração habilitada e provider válido
- **THEN** o botão do Azy Agent aparece e abre a cortina sem perder o contexto da tela atual

#### Scenario: Assistente indisponível
- **WHEN** toggle está desligado ou provider não está configurado
- **THEN** o botão e a cortina não ficam disponíveis para o usuário comum

### Requirement: Conversa contextual com streaming
O sistema SHALL permitir enviar mensagens autenticadas, associadas ao tenant, usuário e projeto opcional, e SHALL transmitir resposta, progresso de tools, perguntas e aprovações de forma incremental e reconectável.

#### Scenario: Usuário faz pergunta sobre o board
- **WHEN** usuário envia pergunta com projeto selecionado
- **THEN** o servidor cria uma mensagem/run, usa contexto autorizado e transmite uma resposta final com referências ou dados do board

#### Scenario: Cliente reconecta ao stream
- **WHEN** a conexão SSE cai durante uma run
- **THEN** o cliente pode reconectar usando `runId` e cursor e recebe eventos faltantes sem duplicar mensagens

### Requirement: Perguntas e aprovações retomáveis
O chat SHALL renderizar perguntas de esclarecimento e pedidos de aprovação como estados pendentes, preservando o run até que o usuário responda, aprove, rejeite ou expire.

#### Scenario: Dados insuficientes
- **WHEN** o pedido não informa projeto, coluna, parentId ou outro dado necessário para uma ação segura
- **THEN** o agente pergunta somente o necessário e não executa a mutação antes da resposta

#### Scenario: Usuário rejeita uma mutação
- **WHEN** usuário rejeita a prévia de uma operação
- **THEN** o run registra a rejeição, não executa a tool e retorna ao estado concluído/cancelado

### Requirement: Importação de texto e CSV pelo chat
O chat SHALL aceitar texto e CSV dentro de limites definidos, gerar uma prévia normalizada com erros por linha e exigir confirmação antes de criar ou alterar itens em lote.

#### Scenario: CSV válido
- **WHEN** usuário cola CSV com colunas reconhecidas e confirma a prévia
- **THEN** o agente cria operações idempotentes autorizadas e informa resultado por item

#### Scenario: CSV ambíguo
- **WHEN** CSV possui coluna desconhecida, parentId ausente ou dados inválidos
- **THEN** o agente lista os problemas, pergunta como resolvê-los e não grava itens parcialmente sem confirmação

### Requirement: Histórico e exclusão de conversa
O sistema SHALL persistir mensagens e estado suficiente para retomar uma conversa e SHALL permitir ao usuário consultar e excluir suas conversas conforme a política de retenção do tenant.

#### Scenario: Usuário reabre conversa
- **WHEN** usuário abre uma conversa anterior dentro do tenant
- **THEN** o chat carrega mensagens e referências sem expor conversas de outro usuário ou tenant
