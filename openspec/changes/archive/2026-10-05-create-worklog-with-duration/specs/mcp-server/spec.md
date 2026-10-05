## ADDED Requirements

### Requirement: Ferramenta create_item_log com duração

O sistema SHALL expor a criação de apontamento de trabalho com `activity` obrigatória e duração opcional, aceitando `durationMin` (minutos) ou `duration` (formato humano-legível normalizado para minutos). A ferramenta SHALL persistir via API com a duração normalizada e SHALL permitir confirmar atividade e duração na resposta sem exigir releitura pesada. Enquanto o domínio não suportar data escolhida, a ferramenta NÃO SHALL aceitar nem prometer data retroativa: o registro é criado no momento atual.

#### Scenario: Criar apontamento com minutos

- **WHEN** agente invoca `create_item_log` com `{ projectId, itemId, activity, durationMin: 90 }`
- **THEN** o apontamento é criado com 90 minutos e a resposta permite confirmar atividade e duração

#### Scenario: Criar apontamento com formato legível

- **WHEN** agente invoca `create_item_log` com `{ projectId, itemId, activity, duration: "1h30" }`
- **THEN** a duração é normalizada para 90 minutos e persistida nesse valor

#### Scenario: Criar apontamento sem duração

- **WHEN** agente invoca `create_item_log` apenas com `{ projectId, itemId, activity }`
- **THEN** o apontamento é criado sem duração, como hoje, sem exigir o campo

#### Scenario: Data retroativa não é aceita

- **WHEN** agente tenta informar uma data escolhida para o apontamento
- **THEN** a chamada é rejeitada ou o campo não é exposto, com mensagem clara de que a data é o momento do registro

#### Scenario: Duração inválida não cria apontamento

- **WHEN** agente invoca `create_item_log` com duração negativa ou fora dos formatos aceitos
- **THEN** o servidor retorna erro de validação acionável e não cria o registro
