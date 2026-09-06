## Requirements

### Requirement: Histórico no chat
O chat MUST carregar a conversa persistida ao abrir e MUST associar confirmação e resposta à run pendente quando aplicável.

#### Scenario: Reabrir drawer
- WHEN o drawer é aberto com uma conversa existente
- THEN mensagens persistidas são exibidas

#### Scenario: Confirmar mutação
- GIVEN uma aprovação pendente única na conversa
- WHEN o usuário confirma
- THEN o cliente usa a ação de aprovação em vez de criar uma mensagem independente
