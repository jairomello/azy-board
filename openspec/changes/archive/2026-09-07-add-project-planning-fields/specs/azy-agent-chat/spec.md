## MODIFIED Requirements

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
