## ADDED Requirements

### Requirement: Descoberta filtrada por policy
O Azy Agent SHALL pesquisar e carregar somente tools autorizadas pela identidade e alvo efetivos. A tela atual MUST NOT conceder nem revogar permissão.

#### Scenario: Tool fora do conjunto inicial mas permitida
- **WHEN** intenção explícita exige tool autorizada de outro domínio
- **THEN** a tool pode ser descoberta e carregada

#### Scenario: Tool encontrada sem permissão
- **WHEN** busca encontra capability cuja policy não é atendida
- **THEN** ela não é carregada e a resposta explica a restrição sem criar preview

#### Scenario: Viewer no board
- **WHEN** VIEWER pede mutação explícita
- **THEN** a busca não carrega a tool de escrita e não tenta contornar via outra operação

### Requirement: Revalidação server-side preservada
Toda execução SHALL revalidar tenant, grupo, membership, manager, papel local e escopo da API key na rota REST, mesmo que a capability tenha sido filtrada previamente.

#### Scenario: Papel muda durante a run
- **WHEN** usuário perde permissão depois da descoberta ou preview
- **THEN** a autorização atual bloqueia a execução

#### Scenario: Alvo de outro tenant
- **WHEN** mensagem ou argumento referencia recurso de outro tenant
- **THEN** o recurso não é revelado, carregado como alvo ou alterado

#### Scenario: Metadata permissiva por erro
- **WHEN** metadata do registry permitir indevidamente uma tool
- **THEN** a rota REST rejeita a operação e o teste de paridade sinaliza a divergência
