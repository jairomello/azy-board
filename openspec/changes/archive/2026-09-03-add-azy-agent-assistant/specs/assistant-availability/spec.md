## ADDED Requirements

### Requirement: Root controla disponibilidade do Azy Agent
O sistema SHALL permitir que somente usuário `ROOT` altere, por tenant, um toggle global de disponibilidade do Azy Agent. O valor padrão para tenants existentes e novos SHALL ser desabilitado.

#### Scenario: Root habilita o assistente
- **WHEN** usuário Root salva o toggle como habilitado
- **THEN** a configuração do tenant é persistida e fica disponível para avaliação da interface e da API

#### Scenario: Usuário não Root tenta alterar o toggle
- **WHEN** usuário sem grupo `ROOT` tenta alterar a disponibilidade
- **THEN** a API rejeita a operação com `403` e não modifica a configuração

### Requirement: Disponibilidade exige configuração válida
O sistema SHALL considerar o Azy Agent disponível para usuários somente quando o toggle do tenant estiver habilitado e existir configuração de modelo ativa e validada.

#### Scenario: Toggle habilitado sem modelo
- **WHEN** o Root habilita o toggle mas não há provider configurado e validado
- **THEN** a interface não exibe a cortina como utilizável e informa que a configuração do modelo está pendente

#### Scenario: Root desabilita o assistente
- **WHEN** o Root desabilita o toggle
- **THEN** novas conversas e runs são bloqueadas, a cortina deixa de ser exibida e runs aguardando ação não podem executar tools

### Requirement: Contexto de disponibilidade é seguro e atualizável
O sistema SHALL expor ao frontend somente estado não sensível de disponibilidade e SHALL revalidar a configuração no início de cada mensagem e execução de tool.

#### Scenario: Frontend consulta disponibilidade
- **WHEN** usuário autenticado carrega qualquer tela protegida
- **THEN** recebe apenas `enabled`, `configured`, `provider` e estado operacional, sem credencial ou token

#### Scenario: Root altera disponibilidade em outra sessão
- **WHEN** o toggle é desabilitado enquanto outro usuário possui o chat aberto
- **THEN** o próximo envio ou tool call é recusado e a UI atualiza para indisponível
