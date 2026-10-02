## Purpose

Definir a disponibilidade global e segura do Azy Agent por tenant.

## Requirements

### Requirement: Root controla disponibilidade do Azy Agent
O sistema SHALL permitir que somente usuário `ROOT` altere, por tenant, um toggle global de disponibilidade do Azy Agent. O valor padrão para tenants existentes e novos SHALL ser desabilitado.

#### Scenario: Root habilita o assistente
- **WHEN** usuário Root salva o toggle como habilitado
- **THEN** a configuração do tenant é persistida e fica disponível para avaliação da interface e da API

#### Scenario: Usuário não Root tenta alterar o toggle
- **WHEN** usuário sem grupo `ROOT` tenta alterar a disponibilidade
- **THEN** a API rejeita a operação com `403` e não modifica a configuração

### Requirement: Disponibilidade exige configuração válida
O sistema SHALL considerar o Azy Agent disponível para usuários somente quando o toggle global do tenant estiver habilitado e existir pelo menos uma configuração de modelo enabled e validada na lista do tenant. A disponibilidade SHALL deixar de depender dos campos singleton legados de provider/modelo após a migração.

#### Scenario: Toggle habilitado sem modelo
- **WHEN** ROOT habilita o toggle mas não existe configuração de modelo enabled e validada
- **THEN** a interface não exibe a cortina como utilizável e informa que a configuração do modelo está pendente

#### Scenario: Um entre vários modelos é válido
- **WHEN** o toggle está habilitado e há uma ou mais configurações enabled e validadas, ainda que outras estejam desativadas ou inválidas
- **THEN** o Azy Agent é considerado configurado e pode selecionar os modelos válidos em sua ordem de fallback

#### Scenario: Root desabilita o assistente
- **WHEN** ROOT desabilita o toggle global
- **THEN** novas conversas e runs são bloqueadas independentemente de quantos modelos estejam configurados

#### Scenario: Nenhum modelo continua elegível
- **WHEN** ROOT desabilita ou remove o último modelo enabled e validado
- **THEN** novas conversas e runs são consideradas indisponíveis até que um modelo elegível seja configurado

### Requirement: Contexto de disponibilidade é seguro e atualizável
O sistema SHALL expor ao frontend somente estado não sensível de disponibilidade e SHALL revalidar a configuração no início de cada mensagem e execução de tool.

#### Scenario: Frontend consulta disponibilidade
- **WHEN** usuário autenticado carrega qualquer tela protegida
- **THEN** recebe apenas `enabled`, `configured`, `provider` e estado operacional, sem credencial ou token

#### Scenario: Root altera disponibilidade em outra sessão
- **WHEN** o toggle é desabilitado enquanto outro usuário possui o chat aberto
- **THEN** o próximo envio ou tool call é recusado e a UI atualiza para indisponível
