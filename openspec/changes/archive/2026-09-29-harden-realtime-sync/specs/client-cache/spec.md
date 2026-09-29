## MODIFIED Requirements

### Requirement: Invalidação e sincronização por eventos WebSocket
O sistema SHALL reconciliar o cache com eventos WebSocket do projeto ativo, aplicando atualizações incrementais quando possível e invalidando/refazendo a consulta quando necessário. Ao reconectar após uma queda, o sistema SHALL reconciliar as consultas ativas do projeto — por replay dos eventos perdidos, por ressincronização (refetch) quando o replay não for possível, ou por ambos em sequência — para sincronizar mudanças perdidas. As telas de dados migradas SHALL reagir aos eventos do projeto que afetam seus dados e SHALL ter suas consultas ativas reconciliadas no reconnect.

#### Scenario: Evento do board atualiza o cache
- **WHEN** um evento de card do projeto ativo é recebido
- **THEN** a entrada de cache do board do projeto é atualizada sem exigir recarregamento manual da tela

#### Scenario: Evento invalida o dashboard
- **WHEN** um evento que altera métricas do projeto ativo é recebido
- **THEN** a consulta do dashboard do projeto é invalidada e refeita de forma coerente

#### Scenario: Evento de metadados invalida a tela migrada correspondente
- **WHEN** um evento que altera dados de uma tela migrada é recebido (ex.: criação de módulo afeta Settings)
- **THEN** a consulta correspondente da tela migrada é invalidada e refeita, sem exigir recarregamento manual

#### Scenario: Reconexão reconcilia o estado
- **WHEN** a conexão WebSocket é restabelecida após uma queda
- **THEN** as consultas ativas do projeto são reconciliadas por replay dos eventos perdidos e/ou refetch, conforme a cobertura do buffer de eventos

#### Scenario: Reconexão reconcilia as telas migradas
- **WHEN** a conexão WebSocket é restabelecida após uma queda com Settings, Projects, TreeView ou outra tela migrada ativa
- **THEN** as consultas ativas dessas telas são reconciliadas para refletir mudanças ocorridas durante a desconexão
