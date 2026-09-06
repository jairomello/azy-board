## Requirements

### Requirement: Run retomável
O harness MUST persistir dados suficientes para retomar uma run após aprovação e MUST preservar idempotência da operação.

#### Scenario: Retomar após aprovação
- GIVEN uma run aguardando aprovação
- WHEN a aprovação é aceita
- THEN a ferramenta é executada e a run continua até estado terminal

### Requirement: Limite de contexto
O harness MUST rejeitar ou resumir contexto acima do limite antes de enviar uma requisição, sem reenviar o catálogo completo por padrão.

#### Scenario: Catálogo reduzido
- WHEN uma intenção é classificada
- THEN apenas a allowlist selecionada é enviada ao provider
