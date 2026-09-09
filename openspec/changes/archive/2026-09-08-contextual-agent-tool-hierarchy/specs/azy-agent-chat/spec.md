## ADDED Requirements

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
