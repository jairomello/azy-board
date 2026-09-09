## Purpose

Definir a conversa contextual do Azy Agent na interface humana.

## Requirements

### Requirement: Cortina lateral global do Azy Agent
O frontend SHALL exibir uma cortina lateral de chat no lado direito das telas protegidas quando o tenant tiver o Azy Agent disponível, permitindo abrir, fechar, redimensionar em desktop quando suportado e usar layout adaptado em mobile.

#### Scenario: Assistente disponível
- **WHEN** usuário autenticado acessa uma tela com configuração habilitada e provider válido
- **THEN** o botão do Azy Agent aparece e abre a cortina sem perder o contexto da tela atual

#### Scenario: Assistente indisponível
- **WHEN** toggle está desligado ou provider não está configurado
- **THEN** o botão e a cortina não ficam disponíveis para o usuário comum

### Requirement: Conversa contextual com streaming
O sistema SHALL permitir enviar mensagens autenticadas, associadas ao tenant, usuário e projeto opcional, e SHALL transmitir resposta, progresso de tools, perguntas e aprovações de forma incremental e reconectável. Quando um projeto estiver selecionado, o contexto injetado no prompt do agente SHALL incluir os campos de planejamento do projeto (`startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours`, `scope`) quando preenchidos, permitindo ao agente usar essas informações como referência nas respostas.

#### Scenario: Usuário faz pergunta sobre o board
- **WHEN** usuário envia pergunta com projeto selecionado
- **THEN** o servidor cria uma mensagem/run, usa contexto autorizado e transmite uma resposta final com referências ou dados do board

#### Scenario: Cliente reconecta ao stream
- **WHEN** a conexão SSE cai durante uma run
- **THEN** o cliente pode reconectar usando `runId` e cursor e recebe eventos faltantes sem duplicar mensagens

#### Scenario: Agente usa dados de planejamento no contexto
- **WHEN** usuário pergunta ao agente sobre o planejamento do projeto selecionado
- **THEN** o agente tem acesso aos campos `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope` no contexto do projeto e pode referenciá-los na resposta

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

### Requirement: Contexto visual como preferência da conversa
O chat SHALL transportar tela, projeto e item atuais como contexto de prioridade. Pedido explícito e autorizado SHALL poder operar em outro recurso ou domínio sem exigir navegação prévia.

#### Scenario: Contexto local usado por padrão
- **WHEN** usuário envia comando sem alvo explícito a partir de um projeto
- **THEN** o agente usa o projeto/item atual e identifica o alvo no preview

#### Scenario: Pedido cross-context autorizado
- **WHEN** usuário pede operação inequívoca em outro domínio ou recurso acessível
- **THEN** o chat continua a execução no mesmo drawer após resolver o alvo

#### Scenario: Tela global
- **WHEN** usuário está em tela sem projeto e não informa alvo project-scoped
- **THEN** o agente pesquisa recursos acessíveis ou pergunta, sem reutilizar o último projeto silenciosamente

### Requirement: Progresso e limitação orientados à conclusão
O chat SHALL informar busca, esclarecimento ou limitação de forma localizada. A interface MUST NOT afirmar que uma tool está indisponível apenas porque não estava no conjunto inicial.

#### Scenario: Capability carregada dinamicamente
- **WHEN** a run encontra uma tool permitida fora do conjunto inicial
- **THEN** o chat continua sem exigir nova mensagem ou mudança de tela

#### Scenario: Recuperação automática
- **WHEN** uma tool falha com erro recuperável
- **THEN** o chat mantém a run ativa enquanto o agente corrige a operação dentro dos limites

#### Scenario: Restrição real
- **WHEN** a operação é proibida ou não implementada
- **THEN** a mensagem explica a razão real e não exibe códigos internos do harness
