## MODIFIED Requirements

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
