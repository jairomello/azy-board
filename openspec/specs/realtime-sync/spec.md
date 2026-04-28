## ADDED Requirements

### Requirement: Sincronização em tempo real via WebSocket
O sistema SHALL manter conexões WebSocket por projeto e transmitir eventos de mudança para todos os participantes conectados (humanos e agentes de IA).

#### Scenario: Card movido por humano visível para todos
- **WHEN** usuário move card por drag-and-drop no board
- **THEN** todos os outros usuários conectados ao mesmo projeto veem o card se mover em tempo real sem necessidade de refresh

#### Scenario: Card movido por agente de IA visível para humanos
- **WHEN** agente de IA move card via API REST ou MCP
- **THEN** board dos usuários humanos atualiza instantaneamente refletindo a mudança

---

### Requirement: Tipos de eventos WebSocket
O sistema SHALL emitir eventos tipados para: criação de card, movimentação de card, atualização de card, exclusão de card, claim/release de task e mudança de sprint ativa.

#### Scenario: Evento de claim de task
- **WHEN** agente de IA faz claim de uma task
- **THEN** card no board de todos os participantes atualiza o responsável e exibe o badge de IA em tempo real

---

### Requirement: Reconexão automática
O sistema SHALL suportar reconexão automática do cliente WebSocket com backoff exponencial em caso de queda de conexão.

#### Scenario: Reconexão após queda de rede
- **WHEN** conexão WebSocket do cliente é interrompida
- **THEN** cliente tenta reconectar automaticamente e, ao reconectar, recebe o estado atual do board para sincronizar eventuais mudanças perdidas

---

### Requirement: Isolamento por projeto
O sistema SHALL garantir que eventos de um projeto não sejam transmitidos para participantes de outros projetos.

#### Scenario: Isolamento de eventos entre projetos
- **WHEN** card é movido no Projeto A
- **THEN** usuários conectados ao Projeto B não recebem o evento
