## MODIFIED Requirements

### Requirement: Contexto de disponibilidade é seguro e atualizável
O sistema SHALL expor ao frontend somente estado não sensível de disponibilidade e SHALL revalidar a configuração no início de cada mensagem e execução de tool. O nome do modelo em uso em um run SHALL poder ser exibido ao usuário dono da conversa, sem expor credenciais, tokens ou outros detalhes sensíveis.

#### Scenario: Frontend consulta disponibilidade
- **WHEN** usuário autenticado carrega qualquer tela protegida
- **THEN** recebe apenas `enabled`, `configured`, `provider` e estado operacional, sem credencial ou token

#### Scenario: Root altera disponibilidade em outra sessão
- **WHEN** o toggle é desabilitado enquanto outro usuário possui o chat aberto
- **THEN** o próximo envio ou tool call é recusado e a UI atualiza para indisponível

#### Scenario: Modelo em uso visível ao dono da conversa
- **WHEN** um usuário autenticado possui um run próprio em andamento
- **THEN** a interface pode exibir o nome do modelo em uso nesse run, sem revelar credencial, token ou detalhes de configuração do provider
