## Requirements

### Requirement: Contexto limitado e persistente
O sistema MUST enviar ao modelo o resumo e uma janela recente da conversa, preservando a mensagem atual e o estado pendente de confirmação dentro do limite configurado.

#### Scenario: Nova mensagem contextual
- GIVEN uma conversa com mensagens anteriores
- WHEN uma nova mensagem é processada
- THEN o modelo recebe o resumo e as mensagens recentes relevantes

### Requirement: Seleção de ferramentas
O sistema MUST enviar somente ferramentas compatíveis com a intenção detectada, mantendo fallback seguro e autorização server-side.

#### Scenario: Consulta simples
- WHEN o usuário pede uma consulta
- THEN ferramentas de leitura relacionadas são enviadas, sem ferramentas destrutivas

### Requirement: Continuação de aprovação
O sistema MUST executar uma aprovação válida uma única vez e continuar a run sem exigir que o modelo reinterprete a confirmação.

#### Scenario: Confirmação explícita
- GIVEN uma aprovação pendente não expirada
- WHEN o usuário confirma com o hash correto
- THEN a operação é executada uma vez e o resultado é continuado ao modelo
