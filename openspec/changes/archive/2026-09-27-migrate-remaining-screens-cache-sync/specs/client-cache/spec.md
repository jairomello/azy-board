## ADDED Requirements

### Requirement: Toda tela de dados usa a camada única de cache
Toda tela ou componente do web que consome estado remoto SHALL obter esses dados exclusivamente pela camada de cache única, sem `fetch` manual em `useEffect`, sem função `load()` imperativa disparada por mutação e sem tokens/gatilhos de refetch próprios. As consultas migradas SHALL usar chaves escopadas por identidade autenticada (e por projeto quando aplicável) e `AbortSignal` para cancelamento.

#### Scenario: Telas migradas não buscam dados fora da camada
- **WHEN** Settings, Projects, TreeView, AdminUsers ou ApiKeys carregam dados do servidor
- **THEN** a busca é feita por consultas da camada de cache única, com chave escopada por identidade e `AbortSignal`

#### Scenario: Refetch imperativo é substituído por invalidação
- **WHEN** uma mutação altera dados consumidos por uma tela migrada
- **THEN** a tela reflete a mudança por invalidação/revalidação do cache, sem `load()` imperativo nem token de refetch próprio

#### Scenario: Troca de projeto não deixa resposta antiga vazar
- **WHEN** o usuário troca de projeto enquanto uma consulta de tela migrada está em andamento
- **THEN** a consulta anterior é cancelada e a resposta obsoleta não sobrescreve os dados do projeto novo

### Requirement: Mutações das telas migradas não divergem do servidor
Toda mutação das telas de dados migradas SHALL seguir a política única de mutação definida em `optimistic-mutations`, e uma falha SHALL NOT deixar o cache divergente do estado do servidor.

#### Scenario: CRUD que falha não atualiza a tela
- **WHEN** uma criação, edição ou exclusão em Settings, AdminUsers ou ApiKeys falha na API
- **THEN** o cache permanece no estado anterior e o usuário é informado do erro

#### Scenario: Sucesso reconcilia a partir do servidor
- **WHEN** uma mutação de tela migrada conclui com sucesso
- **THEN** o cache é atualizado a partir da resposta ou por invalidação e refetch, sem exigir recarregamento manual

## MODIFIED Requirements

### Requirement: Invalidação e sincronização por eventos WebSocket
O sistema SHALL reconciliar o cache com eventos WebSocket do projeto ativo, aplicando atualizações incrementais quando possível e invalidando/refazendo a consulta quando necessário. Ao reconectar após uma queda, o sistema SHALL refazer as consultas ativas do projeto para sincronizar mudanças perdidas. As telas de dados migradas SHALL reagir aos eventos do projeto que afetam seus dados e SHALL ter suas consultas ativas refeitas no reconnect.

#### Scenario: Evento do board atualiza o cache
- **WHEN** um evento de card do projeto ativo é recebido
- **THEN** a entrada de cache do board do projeto é atualizada sem exigir recarregamento manual da tela

#### Scenario: Evento invalida o dashboard
- **WHEN** um evento que altera métricas do projeto ativo é recebido
- **THEN** a consulta do dashboard do projeto é invalidada e refeita de forma coerente

#### Scenario: Evento de metadados invalida a tela migrada correspondente
- **WHEN** um evento que altera dados de uma tela migrada é recebido (ex.: criação de módulo afeta Settings)
- **THEN** a consulta correspondente da tela migrada é invalidada e refeita, sem exigir recarregamento manual

#### Scenario: Reconexão ressincroniza o estado
- **WHEN** a conexão WebSocket é restabelecida após uma queda
- **THEN** as consultas ativas do projeto são refeitas para reconciliar mudanças ocorridas durante a desconexão

#### Scenario: Reconexão ressincroniza as telas migradas
- **WHEN** a conexão WebSocket é restabelecida após uma queda com Settings, Projects, TreeView ou outra tela migrada ativa
- **THEN** as consultas ativas dessas telas são refeitas para reconciliar mudanças ocorridas durante a desconexão
